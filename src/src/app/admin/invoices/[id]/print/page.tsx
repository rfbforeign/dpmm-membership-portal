import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRM } from "@/lib/money";
import { hasBankDetails, ORG } from "@/lib/org";
import { DPMM_LOGO_DATA_URI } from "@/lib/logo";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";
import { getInvoice } from "@/modules/billing/queries";
import { METHOD_LABEL, TYPE_LABEL, type InvoiceType, type PaymentMethod } from "@/modules/billing/validation";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Print invoice" };
export const dynamic = "force-dynamic";

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(STAFF_ROLES, `/admin/invoices/${id}/print`);

  const result = await getInvoice(id);
  if (!result) notFound();
  const { invoice: inv, items, payments } = result;

  const isPaid = inv.status === "paid";
  const isCancelled = inv.status === "cancelled";
  const received = payments.filter((p) => p.status === "successful");
  const billTo = inv.registered_address ?? inv.mailing_address;

  return (
    <>
      <div className="mb-6 flex items-center gap-5 print:hidden">
        <Link href={`/admin/invoices/${id}`} className="font-semibold text-primary underline">Back to invoice</Link>
        <PrintButton label="Print or save as PDF" />
      </div>

      <article className="mx-auto max-w-3xl rounded-md border border-line bg-white p-8 text-primary-deep print:max-w-none print:border-0 print:p-0 sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-4 border-accent pb-6">
          <div className="flex items-start gap-4">
            <img
              src={DPMM_LOGO_DATA_URI}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 object-contain"
            />
            <div>
              <p className="font-display text-3xl font-bold tracking-tight text-primary">{ORG.name}</p>
              {ORG.legalName && <p className="text-sm font-semibold">{ORG.legalName}</p>}
              {ORG.address.map((line) => (
                <p key={line} className="text-sm">{line}</p>
              ))}
              {ORG.email && <p className="text-sm">{ORG.email}</p>}
              {ORG.phone && <p className="text-sm">{ORG.phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-bold uppercase tracking-tight text-primary">Invoice</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{String(inv.invoice_no)}</p>
            {isPaid && <p className="mt-2 inline-block rounded border-2 border-primary px-3 py-0.5 text-lg font-bold uppercase text-primary">Paid</p>}
            {isCancelled && <p className="mt-2 inline-block rounded border-2 border-accent px-3 py-0.5 text-lg font-bold uppercase text-accent">Cancelled</p>}
          </div>
        </header>

        <section className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary-deep/70">Billed to</h2>
            <p className="mt-2 font-semibold">{String(inv.full_name)}</p>
            {inv.company_name && <p>{String(inv.company_name)}</p>}
            {billTo && <p className="whitespace-pre-line text-sm">{String(billTo)}</p>}
            <p className="mt-1 text-sm">{String(inv.email)}</p>
            <p className="mt-1 text-sm tabular-nums">Membership no. {String(inv.membership_no)}</p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm sm:justify-self-end">
            <dt className="text-primary-deep/70">Issued</dt>
            <dd className="tabular-nums">{String(inv.issued_date)}</dd>
            <dt className="text-primary-deep/70">Due</dt>
            <dd className="tabular-nums">{String(inv.due_date)}</dd>
            <dt className="text-primary-deep/70">Type</dt>
            <dd>{TYPE_LABEL[inv.invoice_type as InvoiceType] ?? String(inv.invoice_type)}</dd>
            {inv.period_start && (
              <>
                <dt className="text-primary-deep/70">Covers</dt>
                <dd className="tabular-nums">{String(inv.period_start)} to {String(inv.period_end)}</dd>
              </>
            )}
          </dl>
        </section>

        {inv.description && <p className="mt-6">{String(inv.description)}</p>}

        <table className="mt-6 w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-primary text-sm text-primary">
              <th scope="col" className="py-2 pr-4 font-semibold">Description</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">Qty</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">Price</th>
              <th scope="col" className="py-2 pl-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-2.5 pr-4">{String(it.description)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{String(it.quantity)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{formatRM(String(it.unit_amount))}</td>
                <td className="py-2.5 pl-2 text-right tabular-nums">{formatRM(String(it.line_total))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className="pt-4 text-right font-semibold">Total</th>
              <td className="pt-4 text-right text-xl font-bold tabular-nums text-primary">{formatRM(String(inv.amount))}</td>
            </tr>
            {received.length > 0 && (
              <tr>
                <th scope="row" colSpan={3} className="pt-1 text-right font-normal">Paid</th>
                <td className="pt-1 text-right tabular-nums">{formatRM(String(inv.paid_amount))}</td>
              </tr>
            )}
            {inv.status === "unpaid" && (
              <tr>
                <th scope="row" colSpan={3} className="pt-1 text-right font-semibold">Balance due</th>
                <td className="pt-1 text-right font-semibold tabular-nums text-accent">{formatRM(String(inv.balance))}</td>
              </tr>
            )}
          </tfoot>
        </table>

        {received.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary-deep/70">Payments received</h2>
            <table className="mt-2 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-primary text-primary">
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Receipt</th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">Date</th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">Method</th>
                  <th scope="col" className="py-1.5 pl-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {received.map((p) => (
                  <tr key={String(p.transaction_id)} className="border-b border-line">
                    <td className="py-1.5 pr-3 tabular-nums">{String(p.receipt_no ?? p.transaction_id)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{String(p.paid_on)}</td>
                    <td className="px-2 py-1.5">{METHOD_LABEL[p.method as PaymentMethod] ?? String(p.method)}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums">{formatRM(String(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {inv.status === "unpaid" && hasBankDetails() && (
          <section className="mt-8 rounded border border-line p-4 text-sm">
            <h2 className="font-semibold text-primary">How to pay</h2>
            <p className="mt-1">{ORG.bank.bankName}{ORG.bank.accountName ? `, ${ORG.bank.accountName}` : ""}</p>
            <p className="tabular-nums">Account number: {ORG.bank.accountNumber}</p>
            <p className="mt-1">{ORG.paymentNote}</p>
          </section>
        )}

        <footer className="mt-10 border-t border-line pt-4 text-xs text-primary-deep/60">
          This is a computer-generated document and does not need a signature.
        </footer>
      </article>
    </>
  );
}
