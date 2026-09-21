import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRM } from "@/lib/money";
import { suggestPeriod } from "@/lib/dates";
import { todayInMalaysia } from "@/lib/normalize";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";
import { cancelInvoice } from "@/modules/billing/actions";
import { InvoiceStatusBadge } from "@/modules/billing/invoice-status-badge";
import { canHandlePayments } from "@/modules/billing/permissions";
import { getInvoice } from "@/modules/billing/queries";
import { METHOD_LABEL, PAYMENT_METHODS, TYPE_LABEL, type InvoiceType, type PaymentMethod } from "@/modules/billing/validation";
import { PaymentForm } from "./payment-form";

export const metadata: Metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; paid?: string; cancelled?: string; error?: string }>;
}) {
  const { id } = await params;
  const flags = await searchParams;
  const user = await requireRole(STAFF_ROLES, `/admin/invoices/${id}`);

  const result = await getInvoice(id);
  if (!result) notFound();
  const { invoice: inv, items, payments } = result;

  const today = todayInMalaysia();
  const isUnpaid = inv.status === "unpaid";
  const hasPayments = payments.some((p) => p.status === "successful");
  const canPay = canHandlePayments(user.role);
  const grantsMembership = inv.invoice_type === "registration" || inv.invoice_type === "renewal";
  const suggested = suggestPeriod(inv.member_expiry ?? null, today);
  const defaultPeriod = {
    start: inv.period_start ?? suggested.start,
    end: inv.period_end ?? suggested.end,
  };

  return (
    <>
      <Link href="/admin/invoices" className="text-sm font-semibold text-primary underline">All invoices</Link>

      {flags.created === "1" && <p role="status" className="mt-4 border-l-4 border-primary bg-paper px-4 py-3 text-sm">Invoice created.</p>}
      {flags.paid === "1" && <p role="status" className="mt-4 border-l-4 border-primary bg-paper px-4 py-3 text-sm">Payment recorded.</p>}
      {flags.cancelled === "1" && <p role="status" className="mt-4 border-l-4 border-primary bg-paper px-4 py-3 text-sm">Invoice cancelled.</p>}
      {flags.error === "cancel" && (
        <p role="alert" className="mt-4 border-l-4 border-accent bg-paper px-4 py-3 text-sm">
          This invoice could not be cancelled. Only unpaid invoices with no payments can be cancelled.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-primary">{String(inv.invoice_no)}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-3">
            <InvoiceStatusBadge status={String(inv.status)} overdue={Boolean(inv.is_overdue)} />
            <span>{TYPE_LABEL[inv.invoice_type as InvoiceType] ?? String(inv.invoice_type)}</span>
          </p>
        </div>
        <Link
          href={`/admin/invoices/${id}/print`}
          className="rounded-md border border-primary px-5 py-2.5 font-semibold text-primary hover:bg-paper"
        >
          {inv.status === "paid" ? "Print invoice and receipt" : "Print invoice"}
        </Link>
      </div>

      <dl className="mt-8 grid gap-x-8 gap-y-4 rounded-md border border-line bg-paper p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-primary-deep/75">Member</dt>
          <dd>
            <Link href={`/admin/members/${inv.member_id}`} className="font-semibold text-primary underline">{String(inv.full_name)}</Link>
            {inv.company_name && <span className="block">{String(inv.company_name)}</span>}
            <span className="block text-sm tabular-nums text-primary-deep/75">{String(inv.membership_no)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-primary-deep/75">Dates</dt>
          <dd className="tabular-nums">
            Issued {String(inv.issued_date)}
            <span className="block">Due {String(inv.due_date)}</span>
            {inv.period_start && <span className="block">Covers {String(inv.period_start)} to {String(inv.period_end)}</span>}
          </dd>
        </div>
        {inv.description && (
          <div className="sm:col-span-2">
            <dt className="text-sm text-primary-deep/75">Description</dt>
            <dd>{String(inv.description)}</dd>
          </div>
        )}
      </dl>

      <h2 className="mt-10 font-display text-xl font-semibold text-primary">Lines</h2>
      <div className="mt-3 overflow-x-auto rounded-md border border-line bg-paper">
        <table className="w-full min-w-[32rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-sm text-primary">
              <th scope="col" className="px-4 py-3 font-semibold">Description</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Qty</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Price</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-line">
                <td className="px-4 py-3">{String(it.description)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{String(it.quantity)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRM(String(it.unit_amount))}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRM(String(it.line_total))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className="px-4 py-3 text-right font-semibold">Total</th>
              <td className="px-4 py-3 text-right text-lg font-semibold tabular-nums text-primary">{formatRM(String(inv.amount))}</td>
            </tr>
            <tr>
              <th scope="row" colSpan={3} className="px-4 py-2 text-right font-normal">Paid so far</th>
              <td className="px-4 py-2 text-right tabular-nums">{formatRM(String(inv.paid_amount))}</td>
            </tr>
            {isUnpaid && (
              <tr>
                <th scope="row" colSpan={3} className="px-4 py-2 text-right font-semibold">Balance due</th>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-accent">{formatRM(String(inv.balance))}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {payments.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-xl font-semibold text-primary">Payments</h2>
          <div className="mt-3 overflow-x-auto rounded-md border border-line bg-paper">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-sm text-primary">
                  <th scope="col" className="px-4 py-3 font-semibold">Receipt</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Method</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Reference</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={String(p.transaction_id)} className="border-b border-line last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{String(p.receipt_no ?? p.transaction_id)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{String(p.paid_on)}</td>
                    <td className="px-4 py-3">{METHOD_LABEL[p.method as PaymentMethod] ?? String(p.method)}</td>
                    <td className="px-4 py-3">{p.bank_reference ? String(p.bank_reference) : "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatRM(String(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isUnpaid && canPay && (
        <section className="mt-12" aria-labelledby="record-heading">
          <h2 id="record-heading" className="font-display text-xl font-semibold text-primary">Record a payment</h2>
          <PaymentForm
            invoiceId={id}
            balance={Number(inv.balance).toFixed(2)}
            today={today}
            grantsMembership={grantsMembership}
            defaultPeriod={defaultPeriod}
            methods={PAYMENT_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
          />
        </section>
      )}

      {isUnpaid && !canPay && (
        <p className="mt-10 max-w-prose text-primary-deep/75">Only the treasurer or an administrator can record payments.</p>
      )}

      {isUnpaid && canPay && !hasPayments && (
        <form action={cancelInvoice} className="mt-10">
          <input type="hidden" name="invoiceId" value={id} />
          <button type="submit" className="text-sm font-semibold text-accent underline">
            Cancel this invoice
          </button>
        </form>
      )}
    </>
  );
}
