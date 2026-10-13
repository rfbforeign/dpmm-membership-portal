import { getSql } from "@/db";
import type { MemberStatus } from "@/modules/members/validation";

export interface PortalMemberData {
  member: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    membershipNo: string;
    status: MemberStatus;
    category: string;
    fasal: string;
    memberSince: string | null;
    expiryDate: string | null;
    mailingAddress: string | null;
    registeredAddress: string | null;
    businessSector: string | null;
    businessType: string | null;
    companyName: string | null;
    photoUrl: string | null;
  };
  invoices: {
    id: string;
    invoiceNo: string;
    type: string;
    amount: number;
    balance: number;
    status: string;
    issuedDate: string;
    dueDate: string;
  }[];
  summary: {
    openInvoices: number;
    outstandingBalance: number;
  };
}

export async function findPortalMemberId(userId: string, email: string): Promise<string | null> {
  const [member] = await getSql()(
    `SELECT id
     FROM members
     WHERE deleted_at IS NULL
       AND (user_id = $1 OR (user_id IS NULL AND email = $2))
     ORDER BY CASE WHEN user_id = $1 THEN 0 ELSE 1 END, joined_date DESC
     LIMIT 1`,
    [userId, email]
  );
  return member ? String(member.id) : null;
}

/** Finds the signed-in member's record and recent invoices. */
export async function getPortalMemberData(userId: string, email: string): Promise<PortalMemberData | null> {
  const sql = getSql();
  const memberId = await findPortalMemberId(userId, email);
  if (!memberId) return null;

  const [row] = await sql(
    `SELECT m.id, m.full_name, m.email, m.phone, m.membership_no, m.status,
            t.category, t.fasal, m.joined_date::text AS member_since, m.expiry_date::text AS expiry_date,
            m.mailing_address, m.registered_address, s.name AS business_sector,
            bt.name AS business_type, m.company_name, p.updated_at::text AS photo_updated_at
     FROM members m
     JOIN membership_types t ON t.id = m.membership_type_id
     LEFT JOIN business_sectors s ON s.id = m.business_sector_id
     LEFT JOIN business_types bt ON bt.id = m.business_type_id
     LEFT JOIN member_profile_photos p ON p.member_id = m.id
     WHERE m.id = $1 AND m.deleted_at IS NULL
     LIMIT 1`,
    [memberId]
  );

  if (!row) return null;

  const [invoices, [totals]] = await Promise.all([
    sql(
      `SELECT id, invoice_no, invoice_type, amount::text AS amount, balance::text AS balance,
              status, issued_date::text AS issued_date, due_date::text AS due_date
       FROM invoice_summary
       WHERE member_id = $1
       ORDER BY issued_date DESC, invoice_no DESC
       LIMIT 10`,
      [row.id]
    ),
    sql(
      `SELECT count(*) FILTER (WHERE status = 'unpaid')::int AS open_invoices,
              COALESCE(sum(balance) FILTER (WHERE status = 'unpaid'), 0)::text AS outstanding_balance
       FROM invoice_summary
       WHERE member_id = $1`,
      [row.id]
    ),
  ]);

  return {
    member: {
      id: String(row.id),
      fullName: String(row.full_name),
      email: String(row.email),
      phone: row.phone ? String(row.phone) : null,
      membershipNo: String(row.membership_no),
      status: String(row.status) as MemberStatus,
      category: String(row.category),
      fasal: String(row.fasal),
      memberSince: row.member_since ? String(row.member_since) : null,
      expiryDate: row.expiry_date ? String(row.expiry_date) : null,
      mailingAddress: row.mailing_address ? String(row.mailing_address) : null,
      registeredAddress: row.registered_address ? String(row.registered_address) : null,
      businessSector: row.business_sector ? String(row.business_sector) : null,
      businessType: row.business_type ? String(row.business_type) : null,
      companyName: row.company_name ? String(row.company_name) : null,
      photoUrl: row.photo_updated_at
        ? `/api/portal/member/photo?v=${encodeURIComponent(String(row.photo_updated_at))}`
        : null,
    },
    invoices: invoices.map((invoice) => ({
      id: String(invoice.id),
      invoiceNo: String(invoice.invoice_no),
      type: String(invoice.invoice_type),
      amount: Number(invoice.amount),
      balance: Number(invoice.balance),
      status: String(invoice.status),
      issuedDate: String(invoice.issued_date),
      dueDate: String(invoice.due_date),
    })),
    summary: {
      openInvoices: Number(totals.open_invoices),
      outstandingBalance: Number(totals.outstanding_balance),
    },
  };
}
