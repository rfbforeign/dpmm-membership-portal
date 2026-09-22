-- 0004_automation.sql: renewals, reminders and the email outbox
--
-- notification_logs is the outbox: every email is written here first, then sent.
-- automation_runs records each daily run (and stops two runs on the same day overlapping).
-- The three functions decide who needs what; the app decides when to run them.

ALTER TABLE notification_logs
  ADD COLUMN body_html       text,
  ADD COLUMN attempts        integer NOT NULL DEFAULT 0,
  ADD COLUMN last_attempt_at timestamptz;

CREATE TABLE automation_runs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_date    date NOT NULL,
  mode        text NOT NULL CHECK (mode IN ('dry_run', 'live')),
  status      text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  summary     jsonb,
  error       text
);

-- Only one live run per day (a failed run may be retried)
CREATE UNIQUE INDEX automation_runs_one_live_per_day
  ON automation_runs (run_date) WHERE mode = 'live' AND status IN ('running', 'done');

-- ---------------------------------------------------------------------
-- create_renewal_invoice: next year's annual fee.
-- Continues the day after the current period ends; a lapsed member starts today.
-- Due on the day the current period ends (or today if that has passed).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_renewal_invoice(p_member_id uuid)
RETURNS TABLE (out_invoice_id uuid, out_invoice_no text, out_amount numeric,
               out_period_start date, out_period_end date, out_due_date date)
LANGUAGE plpgsql AS $$
DECLARE
  m       members%ROWTYPE;
  t       membership_types%ROWTYPE;
  v_start date;
  v_end   date;
  v_due   date;
  r       record;
BEGIN
  SELECT * INTO m FROM members WHERE id = p_member_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DPMM:member_not_found';
  END IF;
  SELECT * INTO t FROM membership_types WHERE id = m.membership_type_id;
  IF t.annual_fee <= 0 THEN
    RAISE EXCEPTION 'DPMM:amount_invalid';
  END IF;

  v_start := CASE WHEN m.expiry_date IS NOT NULL AND m.expiry_date >= my_today()
                  THEN m.expiry_date + 1 ELSE my_today() END;
  -- One year later, minus a day. A 29 Feb start rolls to 1 Mar, so its period ends on 28 Feb.
  v_end := (CASE WHEN extract(month FROM v_start) = 2 AND extract(day FROM v_start) = 29
                 THEN make_date(extract(year FROM v_start)::int + 1, 3, 1)
                 ELSE (v_start + interval '1 year')::date END) - 1;
  v_due := GREATEST(COALESCE(m.expiry_date, my_today()), my_today());

  SELECT * INTO r FROM create_invoice(
    p_member_id, 'renewal', 'Annual membership renewal (Fasal ' || t.fasal || ')', v_due, v_start, v_end,
    jsonb_build_array(jsonb_build_object(
      'description', 'Annual membership fee ' || to_char(v_start, 'DD/MM/YYYY') || ' to ' || to_char(v_end, 'DD/MM/YYYY'),
      'quantity', 1, 'unit_amount', t.annual_fee)),
    NULL);

  RETURN QUERY SELECT r.out_invoice_id, r.out_invoice_no, r.out_amount, v_start, v_end, v_due;
END $$;

-- ---------------------------------------------------------------------
-- automation_expire_members: active members whose paid period recently ended.
-- p_apply = false only reports. Members who lapsed longer ago than p_lookback_days are left
-- alone (and listed for a person to review), so old spreadsheet data never triggers emails.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION automation_expire_members(p_lookback_days integer, p_apply boolean)
RETURNS TABLE (out_member_id uuid, out_membership_no text, out_expiry_date date, out_applied boolean)
LANGUAGE plpgsql AS $$
BEGIN
  IF p_apply THEN
    RETURN QUERY
    WITH changed AS (
      UPDATE members m SET status = 'expired'
      WHERE m.deleted_at IS NULL AND m.status = 'active' AND m.expiry_date IS NOT NULL
        AND m.expiry_date < my_today() AND m.expiry_date >= my_today() - p_lookback_days
      RETURNING m.id, m.membership_no, m.expiry_date
    )
    SELECT c.id, c.membership_no, c.expiry_date, true FROM changed c ORDER BY c.membership_no;
  ELSE
    RETURN QUERY
    SELECT m.id, m.membership_no, m.expiry_date, false
    FROM members m
    WHERE m.deleted_at IS NULL AND m.status = 'active' AND m.expiry_date IS NOT NULL
      AND m.expiry_date < my_today() AND m.expiry_date >= my_today() - p_lookback_days
    ORDER BY m.membership_no;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- automation_renewal_candidates: active members whose period ends within p_lead_days
-- and who have no renewal invoice yet (unpaid, or already covering the next period).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION automation_renewal_candidates(p_lead_days integer)
RETURNS TABLE (out_member_id uuid, out_membership_no text, out_expiry_date date)
LANGUAGE sql STABLE AS $$
  SELECT m.id, m.membership_no, m.expiry_date
  FROM members m
  WHERE m.deleted_at IS NULL AND m.status = 'active' AND m.expiry_date IS NOT NULL
    AND m.expiry_date >= my_today() AND m.expiry_date <= my_today() + p_lead_days
    AND NOT EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.member_id = m.id AND i.invoice_type = 'renewal' AND i.status <> 'cancelled'
        AND (i.status = 'unpaid' OR i.period_start = m.expiry_date + 1)
    )
  ORDER BY m.expiry_date, m.membership_no
$$;
