import type { Metadata } from "next";
import Link from "next/link";
import { formatRM } from "@/lib/money";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";
import { InvoiceStatusBadge } from "@/modules/billing/invoice-status-badge";
import {
  INVOICE_PAGE_SIZE,
  INVOICE_STATUS_FILTERS,
  listInvoices,
  type InvoiceFilters,
} from "@/modules/billing/queries";
import { TYPE_LABEL, type InvoiceType } from "@/modules/billing/validation";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

const number = new Intl.NumberFormat("en-MY");
const control = "rounded-md border border-line bg-paper px-3 py-2 text-base text-primary-deep";

function pageHref(filters: { q?: string; status?: string }, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/invoices?${query}` : "/admin/invoices";
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<InvoiceFilters> }) {
  await requireRole(STAFF_ROLES, "/admin/invoices");
  const { rows, total, page, pageCount, filters } = await listInvoices(await searchParams);

  const first = total === 0 ? 0 : (page - 1) * INVOICE_PAGE_SIZE + 1;
  const last = Math.min(page * INVOICE_PAGE_SIZE, total);
  const filtered = Boolean(filters.q || filters.status);

  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight text-primary">Invoices</h1>

      <form method="get" className="mt-8 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="block text-sm font-semibold text-primary">Search</label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder="Invoice number, member name, company or membership no"
            className={`mt-1.5 block w-full ${control}`}
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-semibold text-primary">Status</label>
          <select id="status" name="status" defaultValue={filters.status ?? ""} className={`mt-1.5 block ${control}`}>
            <option value="">All</option>
            {INVOICE_STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-md bg-primary px-5 py-2 font-semibold text-cream hover:bg-primary-deep">
          Search
        </button>
        {filtered && (
          <Link href="/admin/invoices" className="py-2 text-sm font-semibold text-primary underline">Clear</Link>
        )}
      </form>

      <p className="mt-6 text-sm" aria-live="polite">
        {total === 0
          ? "No invoices yet. Create one from a member's page."
          : `Showing ${number.format(first)} to ${number.format(last)} of ${number.format(total)} invoices`}
      </p>

      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-md border border-line bg-paper">
          <table className="w-full min-w-[48rem] border-collapse text-left">
            <caption className="sr-only">Invoices</caption>
            <thead>
              <tr className="border-b border-line text-sm text-primary">
                <th scope="col" className="px-4 py-3 font-semibold">Invoice</th>
                <th scope="col" className="px-4 py-3 font-semibold">Member</th>
                <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Balance</th>
                <th scope="col" className="px-4 py-3 font-semibold">Due</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="border-b border-line last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/admin/invoices/${r.id}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                      {String(r.invoice_no)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/members/${r.member_id}`} className="hover:underline">{String(r.full_name)}</Link>
                    <span className="block text-sm tabular-nums text-primary-deep/75">{String(r.membership_no)}</span>
                  </td>
                  <td className="px-4 py-3">{TYPE_LABEL[r.invoice_type as InvoiceType] ?? String(r.invoice_type)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatRM(String(r.amount))}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {r.status === "unpaid" ? formatRM(String(r.balance)) : "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{String(r.due_date)}</td>
                  <td className="px-4 py-3"><InvoiceStatusBadge status={String(r.status)} overdue={Boolean(r.is_overdue)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav aria-label="Pages" className="mt-5 flex items-center gap-4">
          {page > 1 ? (
            <Link href={pageHref(filters, page - 1)} className="font-semibold text-primary underline">Previous</Link>
          ) : (
            <span className="text-primary-deep/40">Previous</span>
          )}
          <span className="text-sm">Page {page} of {pageCount}</span>
          {page < pageCount ? (
            <Link href={pageHref(filters, page + 1)} className="font-semibold text-primary underline">Next</Link>
          ) : (
            <span className="text-primary-deep/40">Next</span>
          )}
        </nav>
      )}
    </>
  );
}
