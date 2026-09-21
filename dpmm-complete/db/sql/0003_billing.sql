-- 0003_billing.sql: invoices, payments and membership periods
--
-- The money rules live in the database as functions, so each action is all-or-nothing:
--   create_invoice               builds an invoice and its line items with the next invoice number
--   create_registration_invoice  the invoice a new applicant gets (registration fee + first year)
--   record_payment               records a payment; when it settles the invoice it also marks the
--                                invoice paid, adds the membership period, and updates the member's
--                                expiry date and status
--
-- Errors are raised as 'DPMM:<code>' so the app can show a clear message.

CREATE SEQUENCE payment_txn_seq START 1;
CREATE SEQUENCE receipt_no_seq  START 1;

-- Today's date in Malaysia. The database clock is UTC, which is a day behind until 8am.
CREATE OR REPLACE FUNCTION my_today() RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date $$;

-- ---------------------------------------------------------------------
-- Invoice with balance, so lists do not repeat the maths
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW invoice_summary AS
SELECT i.id, i.invoice_no, i.member_id, i.invoice_type, i.description, i.amount, i.status,
       i.issued_date, i.due_date, i.period_start, i.period_end, i.created_at,
       COALESCE(p.paid, 0)::numeric(12,2)              AS paid_amount,
       (i.amount - COALESCE(p.paid, 0))::numeric(12,2) AS balance,
       (i.status = 'unpaid' AND i.due_date < my_today()) AS is_overdue
FROM invoices i
LEFT JOIN (
  SELECT invoice_id, sum(amount) AS paid FROM payments WHERE status = 'successful' GROUP BY invoice_id
) p ON p.invoice_id = i.id;

-- ---------------------------------------------------------------------
-- create_invoice
-- p_items is a JSON array: [{"description":"...","quantity":1,"unit_amount":150.00}, ...]
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_invoice(
  p_member_id    uuid,
  p_type         invoice_type,
  p_description  text,
  p_due_date     date,
  p_period_start date,
  p_period_end   date,
  p_items        jsonb,
  p_actor        uuid
) RETURNS TABLE (out_invoice_id uuid, out_invoice_no text, out_amount numeric)
LANGUAGE plpgsql AS $$
DECLARE
  v_id    uuid;
  v_no    text;
  v_total numeric(12,2);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM members WHERE id = p_member_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'DPMM:member_not_found';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'DPMM:no_items';
  END IF;

  SELECT COALESCE(sum((e->>'quantity')::int * (e->>'unit_amount')::numeric), 0)
    INTO v_total FROM jsonb_array_elements(p_items) AS e;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'DPMM:amount_invalid';
  END IF;
  IF p_due_date < my_today() THEN
    RAISE EXCEPTION 'DPMM:due_date_invalid';
  END IF;

  v_no := 'INV-' || to_char(my_today(), 'YYYY') || '-' || lpad(nextval('invoice_no_seq')::text, 4, '0');

  INSERT INTO invoices (invoice_no, member_id, invoice_type, description, amount, status,
                        issued_date, due_date, period_start, period_end, created_by)
  VALUES (v_no, p_member_id, p_type, NULLIF(btrim(p_description), ''), v_total, 'unpaid',
          my_today(), p_due_date, p_period_start, p_period_end, p_actor)
  RETURNING id INTO v_id;

  INSERT INTO invoice_items (invoice_id, description, quantity, unit_amount, sort_order)
  SELECT v_id, btrim(x.e->>'description'), (x.e->>'quantity')::int, (x.e->>'unit_amount')::numeric,
         (x.n - 1)::smallint
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS x(e, n);

  RETURN QUERY SELECT v_id, v_no, v_total;
END $$;

-- ---------------------------------------------------------------------
-- create_registration_invoice: registration fee + first year, due in 14 days
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_registration_invoice(p_member_id uuid)
RETURNS TABLE (out_invoice_id uuid, out_invoice_no text, out_amount numeric)
LANGUAGE plpgsql AS $$
DECLARE
  t membership_types%ROWTYPE;
BEGIN
  SELECT mt.* INTO t
  FROM membership_types mt JOIN members m ON m.membership_type_id = mt.id
  WHERE m.id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DPMM:member_not_found';
  END IF;

  RETURN QUERY SELECT * FROM create_invoice(
    p_member_id, 'registration', 'Membership application (Fasal ' || t.fasal || ')',
    my_today() + 14, NULL, NULL,
    jsonb_build_array(
      jsonb_build_object('description', 'Registration fee', 'quantity', 1, 'unit_amount', t.registration_fee),
      jsonb_build_object('description', 'Annual membership fee (first year)', 'quantity', 1, 'unit_amount', t.annual_fee)
    ),
    NULL);
END $$;

-- ---------------------------------------------------------------------
-- record_payment
-- A payment may be partial. When the total paid reaches the invoice amount:
--   * the invoice becomes paid
--   * for registration/renewal invoices, the membership period (p_period_start..p_period_end,
--     or the invoice's own dates) is added and the member's expiry date is updated
--   * a pending or expired member becomes active (or stays expired if the period is already over)
-- Suspended members are never reactivated automatically.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_payment(
  p_invoice_id   uuid,
  p_amount       numeric,
  p_method       payment_method,
  p_paid_on      date,
  p_reference    text,
  p_period_start date,
  p_period_end   date,
  p_actor        uuid
) RETURNS TABLE (
  out_payment_id      uuid,
  out_transaction_id  text,
  out_receipt_no      text,
  out_invoice_status  invoice_status,
  out_member_status   member_status,
  out_expiry_date     date
)
LANGUAGE plpgsql AS $$
DECLARE
  inv          invoices%ROWTYPE;
  v_paid       numeric(12,2);
  v_txn        text;
  v_receipt    text;
  v_payment_id uuid;
  v_start      date;
  v_end        date;
  v_expiry     date;
  v_status     member_status;
  v_new_status member_status;
BEGIN
  SELECT * INTO inv FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DPMM:invoice_not_found';
  END IF;
  IF inv.status <> 'unpaid' THEN
    RAISE EXCEPTION 'DPMM:invoice_not_payable';
  END IF;
  IF p_paid_on IS NULL OR p_paid_on > my_today() THEN
    RAISE EXCEPTION 'DPMM:date_invalid';
  END IF;

  SELECT COALESCE(sum(p.amount), 0) INTO v_paid
  FROM payments p WHERE p.invoice_id = inv.id AND p.status = 'successful';

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > inv.amount - v_paid THEN
    RAISE EXCEPTION 'DPMM:amount_invalid';
  END IF;

  IF v_paid + p_amount = inv.amount AND inv.invoice_type IN ('registration', 'renewal') THEN
    v_start := COALESCE(p_period_start, inv.period_start);
    v_end   := COALESCE(p_period_end,   inv.period_end);
    IF v_start IS NULL OR v_end IS NULL OR v_end < v_start THEN
      RAISE EXCEPTION 'DPMM:period_required';
    END IF;
  END IF;

  v_txn     := 'TXN-' || to_char(my_today(), 'YYYY') || '-' || lpad(nextval('payment_txn_seq')::text, 5, '0');
  v_receipt := 'RCP-' || to_char(my_today(), 'YYYY') || '-' || lpad(nextval('receipt_no_seq')::text, 4, '0');

  INSERT INTO payments (transaction_id, invoice_id, member_id, amount, method, status,
                        paid_at, bank_reference, receipt_no, recorded_by)
  VALUES (v_txn, inv.id, inv.member_id, p_amount, p_method, 'successful',
          (p_paid_on::timestamp AT TIME ZONE 'Asia/Kuala_Lumpur'),
          NULLIF(btrim(p_reference), ''), v_receipt, p_actor)
  RETURNING id INTO v_payment_id;

  IF v_paid + p_amount = inv.amount THEN
    UPDATE invoices SET status = 'paid' WHERE id = inv.id;

    IF inv.invoice_type IN ('registration', 'renewal') THEN
      BEGIN
        INSERT INTO membership_periods (member_id, period_start, period_end, invoice_id, source)
        VALUES (inv.member_id, v_start, v_end, inv.id, 'invoice');
      EXCEPTION WHEN exclusion_violation THEN
        RAISE EXCEPTION 'DPMM:period_overlaps';
      END;

      SELECT max(mp.period_end) INTO v_expiry FROM membership_periods mp WHERE mp.member_id = inv.member_id;
      SELECT m.status INTO v_status FROM members m WHERE m.id = inv.member_id FOR UPDATE;

      IF v_status IN ('pending', 'expired') THEN
        v_new_status := (CASE WHEN v_expiry >= my_today() THEN 'active' ELSE 'expired' END)::member_status;
      ELSE
        v_new_status := v_status;
      END IF;

      UPDATE members SET expiry_date = v_expiry, status = v_new_status WHERE id = inv.member_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT v_payment_id, v_txn, v_receipt,
         (SELECT i.status FROM invoices i WHERE i.id = inv.id),
         (SELECT m.status FROM members m WHERE m.id = inv.member_id),
         (SELECT m.expiry_date FROM members m WHERE m.id = inv.member_id);
END $$;

-- ---------------------------------------------------------------------
-- Dashboard: outstanding now counts what is still owed (after part-payments),
-- and "overdue" uses Malaysia's date. Same columns as before.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT
  (SELECT count(*) FROM members WHERE deleted_at IS NULL)                            AS total_members,
  (SELECT count(*) FROM members WHERE deleted_at IS NULL AND status = 'active')      AS active_members,
  (SELECT count(*) FROM members WHERE deleted_at IS NULL AND status = 'pending')     AS pending_members,
  (SELECT count(*) FROM members WHERE deleted_at IS NULL AND status = 'expired')     AS expired_members,
  (SELECT count(*) FROM members WHERE deleted_at IS NULL AND status = 'suspended')   AS suspended_members,
  (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'successful')        AS total_revenue,
  (SELECT COALESCE(sum(amount), 0) FROM invoices WHERE status <> 'cancelled')        AS total_invoiced,
  (SELECT COALESCE(sum(balance), 0) FROM invoice_summary WHERE status = 'unpaid')    AS outstanding_amount,
  (SELECT count(*) FROM invoices WHERE status = 'unpaid')                            AS unpaid_invoices,
  (SELECT count(*) FROM invoice_summary WHERE is_overdue)                            AS overdue_invoices;
