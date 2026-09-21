import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";
import { getInvoiceDefaults, isUuid } from "@/modules/billing/queries";
import { TYPE_LABEL, INVOICE_TYPES, MAX_ITEM_ROWS, type InvoiceType } from "@/modules/billing/validation";
import { NewInvoiceForm } from "./new-invoice-form";

export const metadata: Metadata = { title: "New invoice" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; type?: string }>;
}) {
  const { member, type } = await searchParams;
  await requireRole(STAFF_ROLES, member ? `/admin/invoices/new?member=${member}` : "/admin/invoices");

  if (!member || !isUuid(member)) notFound();
  const invoiceType: InvoiceType = INVOICE_TYPES.find((t) => t === type) ?? "renewal";

  const defaults = await getInvoiceDefaults(member, invoiceType);
  if (!defaults) notFound();
  const m = defaults.member;

  return (
    <>
      <Link href={`/admin/members/${m.id}`} className="text-sm font-semibold text-primary underline">
        Back to {m.fullName}
      </Link>

      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-primary">New invoice</h1>
      <p className="mt-2 text-lg">
        {m.fullName}
        {m.companyName ? `, ${m.companyName}` : ""}{" "}
        <span className="tabular-nums text-primary-deep/70">({m.membershipNo}, Fasal {m.fasal})</span>
      </p>

      <nav aria-label="Invoice type" className="mt-6 flex flex-wrap gap-2">
        {INVOICE_TYPES.map((t) => (
          <Link
            key={t}
            href={`/admin/invoices/new?member=${m.id}&type=${t}`}
            aria-current={t === invoiceType ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
              t === invoiceType ? "border-primary bg-primary text-cream" : "border-line bg-paper text-primary hover:border-primary"
            }`}
          >
            {TYPE_LABEL[t]}
          </Link>
        ))}
      </nav>

      <NewInvoiceForm
        // A new type reloads the page with that type's lines and dates
        key={invoiceType}
        memberId={m.id}
        invoiceType={invoiceType}
        cancelHref={`/admin/members/${m.id}`}
        rows={MAX_ITEM_ROWS}
        initial={{
          description: "",
          dueDate: defaults.dueDate,
          periodStart: invoiceType === "other" ? "" : defaults.period.start,
          periodEnd: invoiceType === "other" ? "" : defaults.period.end,
          items: defaults.items,
        }}
      />
    </>
  );
}
