import { getSql } from "@/db";
import { escapeLike, todayInMalaysia } from "@/lib/normalize";
import { addDays, suggestPeriod } from "@/lib/dates";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";

export const INVOICE_PAGE_SIZE = 25;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

export interface InvoiceFilters {
  q?: string;
  status?: string; // unpaid | overdue | paid | cancelled
  page?: string;
}

export const INVOICE_STATUS_FILTERS = [
  { value: "unpaid", label: "Unpaid (all)" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
] as const;

/** Staff only. One page of invoices, newest first. */
export async function listInvoices(raw: InvoiceFilters) {
  await requireRole(STAFF_ROLES);

  const q = raw.q?.trim().slice(0, 100) || undefined;
  const status = INVOICE_STATUS_FILTERS.find((s) => s.value === raw.status)?.value;
  const requestedPage = Number(raw.page);

  const params: unknown[] = [];
  const where: string[] = [];
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    const p = `$${params.length}`;
    where.push(`(s.invoice_no ILIKE ${p} OR m.full_name ILIKE ${p} OR m.company_name ILIKE ${p} OR m.membership_no ILIKE ${p})`);
  }
  if (status === "overdue") where.push("s.is_overdue");
  else if (status) {
    params.push(status);
    where.push(`s.status = $${params.length}::invoice_status`);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const sql = getSql();
  const [{ total }] = await sql.query(
    `SELECT count(*)::int AS total FROM invoice_summary s JOIN members m ON m.id = s.member_id ${whereSql}`,
    params
  );
  const pageCount = Math.max(1, Math.ceil(Number(total) / INVOICE_PAGE_SIZE));
  const page = Math.min(Math.max(Number.isInteger(requestedPage) ? requestedPage : 1, 1), pageCount);

  const rows = await sql.query(
    `SELECT s.id, s.invoice_no, s.invoice_type, s.amount::text AS amount, s.paid_amount::text AS paid_amount,
            s.balance::text AS balance, s.status, s.is_overdue, s.issued_date::text AS issued_date,
            s.due_date::text AS due_date, m.id AS member_id, m.full_name, m.company_name, m.membership_no
     FROM invoice_summary s JOIN members m ON m.id = s.member_id
     ${whereSql}
     ORDER BY s.issued_date DESC, s.invoice_no DESC
     LIMIT ${INVOICE_PAGE_SIZE} OFFSET ${(page - 1) * INVOICE_PAGE_SIZE}`,
    params
  );

  return { rows, total: Number(total), page, pageCount, filters: { q, status } };
}

/** Staff only. One invoice with its member, line items and payments. */
export async function getInvoice(id: string) {
  await requireRole(STAFF_ROLES);
  if (!isUuid(id)) return null;

  const sql = getSql();
  const [invoice] = await sql.query(
    `SELECT s.id, s.invoice_no, s.invoice_type, s.description, s.amount::text AS amount, s.status, s.is_overdue,
            s.paid_amount::text AS paid_amount, s.balance::text AS balance,
            s.issued_date::text AS issued_date, s.due_date::text AS due_date,
            s.period_start::text AS period_start, s.period_end::text AS period_end,
            m.id AS member_id, m.membership_no, m.full_name, m.company_name, m.email, m.phone,
            m.registered_address, m.mailing_address, m.status AS member_status, m.expiry_date::text AS member_expiry
     FROM invoice_summary s JOIN members m ON m.id = s.member_id
     WHERE s.id = $1`,
    [id]
  );
  if (!invoice) return null;

  const [items, payments] = await Promise.all([
    sql.query(
      `SELECT description, quantity, unit_amount::text AS unit_amount, line_total::text AS line_total
       FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order`,
      [id]
    ),
    sql.query(
      `SELECT transaction_id, receipt_no, amount::text AS amount, method, status, bank_reference,
              (paid_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date::text AS paid_on
       FROM payments WHERE invoice_id = $1 ORDER BY paid_at, created_at`,
      [id]
    ),
  ]);

  return { invoice, items, payments };
}

/** Staff only. Every invoice for one member, newest first. */
export async function getMemberInvoices(memberId: string) {
  await requireRole(STAFF_ROLES);
  if (!isUuid(memberId)) return [];
  return getSql().query(
    `SELECT id, invoice_no, invoice_type, amount::text AS amount, balance::text AS balance, status, is_overdue,
            issued_date::text AS issued_date, due_date::text AS due_date
     FROM invoice_summary WHERE member_id = $1 ORDER BY issued_date DESC, invoice_no DESC`,
    [memberId]
  );
}

/** Staff only. What the "new invoice" form starts with for a member. */
export async function getInvoiceDefaults(memberId: string, type: "registration" | "renewal" | "other") {
  await requireRole(STAFF_ROLES);
  if (!isUuid(memberId)) return null;

  const [row] = await getSql().query(
    `SELECT m.id, m.membership_no, m.full_name, m.company_name, m.expiry_date::text AS expiry_date,
            t.fasal, t.registration_fee::text AS registration_fee, t.annual_fee::text AS annual_fee
     FROM members m JOIN membership_types t ON t.id = m.membership_type_id
     WHERE m.id = $1 AND m.deleted_at IS NULL`,
    [memberId]
  );
  if (!row) return null;

  const today = todayInMalaysia();
  const period = suggestPeriod(row.expiry_date ?? null, today);
  const year = period.start.slice(0, 4);

  const items: { description: string; quantity: string; amount: string }[] = [];
  if (type === "registration") {
    items.push({ description: "Registration fee", quantity: "1", amount: Number(row.registration_fee).toFixed(2) });
    items.push({ description: "Annual membership fee (first year)", quantity: "1", amount: Number(row.annual_fee).toFixed(2) });
  } else if (type === "renewal") {
    items.push({ description: `Annual membership fee ${year}`, quantity: "1", amount: Number(row.annual_fee).toFixed(2) });
  }

  return {
    member: {
      id: String(row.id),
      membershipNo: String(row.membership_no),
      fullName: String(row.full_name),
      companyName: row.company_name ? String(row.company_name) : null,
      fasal: String(row.fasal),
    },
    items,
    period,
    dueDate: addDays(today, 14),
    today,
  };
}

/** Staff only. Every membership period recorded for a member, newest first, and where it came from. */
export async function getMemberPeriods(memberId: string) {
  await requireRole(STAFF_ROLES);
  if (!isUuid(memberId)) return [];
  return getSql().query(
    `SELECT p.period_start::text AS period_start, p.period_end::text AS period_end, p.source, p.notes, i.invoice_no
     FROM membership_periods p LEFT JOIN invoices i ON i.id = p.invoice_id
     WHERE p.member_id = $1 ORDER BY p.period_start DESC`,
    [memberId]
  );
}
