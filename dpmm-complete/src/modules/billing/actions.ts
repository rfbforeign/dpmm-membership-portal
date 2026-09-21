"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSql } from "@/db";
import { todayInMalaysia } from "@/lib/normalize";
import { writeAudit } from "@/modules/audit/log";
import { enqueueNotification, sendQueued } from "@/modules/notifications/outbox";
import { receiptKey } from "@/modules/notifications/reminders";
import { renderEmail } from "@/modules/notifications/templates";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";
import type { MemberFormState } from "@/modules/members/types";
import { PAYMENT_ROLES } from "./permissions";
import { isUuid } from "./queries";
import { billingErrorMessage, MAX_ITEM_ROWS, METHOD_LABEL, validateInvoiceForm, validatePaymentForm } from "./validation";

// ---------------------------------------------------------------------------
// Create an invoice
// ---------------------------------------------------------------------------

export async function createInvoice(_previous: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const user = await requireRole(STAFF_ROLES);

  const memberId = String(formData.get("memberId") ?? "");
  if (!isUuid(memberId)) return { error: "That member could not be found." };

  const raw: Record<string, string> = {};
  for (const field of ["invoiceType", "description", "dueDate", "periodStart", "periodEnd"]) {
    raw[field] = String(formData.get(field) ?? "");
  }
  for (let n = 1; n <= MAX_ITEM_ROWS; n++) {
    for (const part of ["Description", "Quantity", "Amount"]) {
      raw[`item${n}${part}`] = String(formData.get(`item${n}${part}`) ?? "");
    }
  }

  const result = validateInvoiceForm(raw, { today: todayInMalaysia() });
  if (!result.ok) {
    return { error: "Please fix the highlighted fields.", fieldErrors: result.fieldErrors, values: raw };
  }
  const d = result.data;

  let invoiceId: string;
  try {
    const [created] = await getSql()`
      SELECT * FROM create_invoice(
        ${memberId}::uuid, ${d.invoiceType}::invoice_type, ${d.description}, ${d.dueDate}::date,
        ${d.periodStart}::date, ${d.periodEnd}::date,
        ${JSON.stringify(d.items.map((i) => ({ description: i.description, quantity: i.quantity, unit_amount: i.unitAmount })))}::jsonb,
        ${user.id}::uuid)`;
    invoiceId = String(created.out_invoice_id);
    await writeAudit({
      actorId: user.id,
      action: "invoice.create",
      entityType: "invoice",
      entityId: invoiceId,
      changes: { invoiceNo: created.out_invoice_no, memberId, total: created.out_amount, type: d.invoiceType },
    });
  } catch (error) {
    console.error("Create invoice failed", error);
    return { error: billingErrorMessage(error), values: raw };
  }

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/members/${memberId}`);
  redirect(`/admin/invoices/${invoiceId}?created=1`);
}

// ---------------------------------------------------------------------------
// Record a payment
// ---------------------------------------------------------------------------

export async function recordPayment(_previous: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const user = await requireRole(PAYMENT_ROLES);

  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!isUuid(invoiceId)) return { error: "That invoice could not be found." };

  const raw: Record<string, string> = {};
  for (const field of ["amount", "method", "paidOn", "reference", "periodStart", "periodEnd"]) {
    raw[field] = String(formData.get(field) ?? "");
  }

  const sql = getSql();
  const [invoice] = await sql`
    SELECT status, invoice_type, balance::text AS balance, period_start::text AS period_start, period_end::text AS period_end
    FROM invoice_summary WHERE id = ${invoiceId}::uuid`;
  if (!invoice) return { error: "That invoice could not be found." };
  if (invoice.status !== "unpaid") return { error: "This invoice is already paid or cancelled.", values: raw };

  const result = validatePaymentForm(raw, {
    today: todayInMalaysia(),
    balanceCents: Math.round(Number(invoice.balance) * 100),
    grantsMembership: invoice.invoice_type === "registration" || invoice.invoice_type === "renewal",
    invoicePeriod: { start: invoice.period_start ?? null, end: invoice.period_end ?? null },
  });
  if (!result.ok) {
    return { error: "Please fix the highlighted fields.", fieldErrors: result.fieldErrors, values: raw };
  }
  const d = result.data;

  try {
    // One database function does all of it or none of it: payment, invoice status, membership period, member status
    const [paid] = await sql`
      SELECT * FROM record_payment(
        ${invoiceId}::uuid, ${d.amount}::numeric, ${d.method}::payment_method, ${d.paidOn}::date,
        ${d.reference}, ${d.periodStart}::date, ${d.periodEnd}::date, ${user.id}::uuid)`;
    await writeAudit({
      actorId: user.id,
      action: "payment.record",
      entityType: "invoice",
      entityId: invoiceId,
      changes: {
        transactionId: paid.out_transaction_id,
        receiptNo: paid.out_receipt_no,
        amount: d.amount,
        method: d.method,
        invoiceStatus: paid.out_invoice_status,
        memberStatus: paid.out_member_status,
        expiryDate: paid.out_expiry_date,
      },
    });

    // Receipt email. Queued first, then sent if email is set up. A problem here must never undo a recorded payment.
    try {
      const [who] = await sql`
        SELECT m.id AS member_id, m.full_name, m.email, m.membership_no, s.invoice_no, s.balance::text AS balance
        FROM invoice_summary s JOIN members m ON m.id = s.member_id WHERE s.id = ${invoiceId}::uuid`;
      if (who) {
        const fullyPaid = paid.out_invoice_status === "paid";
        const mail = renderEmail("payment_receipt", {
          memberName: String(who.full_name),
          membershipNo: String(who.membership_no),
          invoiceNo: String(who.invoice_no),
          receiptNo: String(paid.out_receipt_no),
          paidAmount: d.amount,
          paidOn: d.paidOn,
          method: METHOD_LABEL[d.method],
          balance: String(who.balance),
          expiryDate: fullyPaid && paid.out_expiry_date ? String(paid.out_expiry_date) : undefined,
        });
        await enqueueNotification({
          memberId: String(who.member_id),
          invoiceId,
          type: "payment_receipt",
          recipient: String(who.email),
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          dedupeKey: receiptKey(String(paid.out_receipt_no)),
        });
        await sendQueued(3);
      }
    } catch (mailError) {
      console.error("Receipt email could not be queued", mailError);
    }
  } catch (error) {
    console.error("Record payment failed", error);
    return { error: billingErrorMessage(error), values: raw };
  }

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin");
  redirect(`/admin/invoices/${invoiceId}?paid=1`);
}

// ---------------------------------------------------------------------------
// Cancel an unpaid invoice that has no payments
// ---------------------------------------------------------------------------

export async function cancelInvoice(formData: FormData): Promise<void> {
  const user = await requireRole(PAYMENT_ROLES);

  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!isUuid(invoiceId)) redirect("/admin/invoices");

  const rows = await getSql()`
    UPDATE invoices SET status = 'cancelled', cancelled_at = now()
    WHERE id = ${invoiceId}::uuid AND status = 'unpaid'
      AND NOT EXISTS (SELECT 1 FROM payments WHERE invoice_id = ${invoiceId}::uuid AND status = 'successful')
    RETURNING invoice_no`;

  if (rows.length === 0) redirect(`/admin/invoices/${invoiceId}?error=cancel`);

  await writeAudit({
    actorId: user.id,
    action: "invoice.cancel",
    entityType: "invoice",
    entityId: invoiceId,
    changes: { invoiceNo: rows[0].invoice_no },
  });
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin");
  redirect(`/admin/invoices/${invoiceId}?cancelled=1`);
}
