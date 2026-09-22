import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";
import { canEditMembers } from "@/modules/members/permissions";
import { formatRM } from "@/lib/money";
import { InvoiceStatusBadge } from "@/modules/billing/invoice-status-badge";
import { getMemberInvoices, getMemberPeriods } from "@/modules/billing/queries";
import { todayInMalaysia } from "@/lib/normalize";
import { TYPE_LABEL, type InvoiceType } from "@/modules/billing/validation";
import { getMember } from "@/modules/members/queries";
import { StatusBadge } from "@/modules/members/status-badge";

export const metadata: Metadata = { title: "Member" };
export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line px-5 py-3.5 last:border-b-0 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <dt className="text-sm text-primary-deep/75">{label}</dt>
      <dd className="break-words text-primary-deep">{children || <span className="text-primary-deep/40">Not recorded</span>}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold text-primary">{title}</h2>
      <dl className="mt-3 rounded-md border border-line bg-paper">{children}</dl>
    </section>
  );
}

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const user = await requireRole(STAFF_ROLES, `/admin/members/${id}`);

  const result = await getMember(id);
  if (!result) notFound();
  const [invoices, periods] = await Promise.all([getMemberInvoices(id), getMemberPeriods(id)]);
  const today = todayInMalaysia();
  const { member: m, typeFasal, typeCategory, sectorName, businessTypeName, introducerName, legacy, icHidden } = result;

  return (
    <>
      <Link href="/admin/members" className="text-sm font-semibold text-primary underline">
        All members
      </Link>

      {saved === "1" && (
        <div role="status" className="mt-4 border-l-4 border-primary bg-paper px-4 py-3 text-sm">
          Changes saved.
        </div>
      )}
      {saved === "0" && (
        <div role="status" className="mt-4 border-l-4 border-primary bg-paper px-4 py-3 text-sm">
          Nothing was changed.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-primary">{m.fullName}</h1>
          {m.companyName && <p className="mt-1 text-lg">{m.companyName}</p>}
          <p className="mt-2 flex items-center gap-3">
            <span className="tabular-nums">{m.membershipNo}</span>
            <StatusBadge status={m.status} />
          </p>
        </div>
        {canEditMembers(user.role) && (
          <Link
            href={`/admin/members/${m.id}/edit`}
            className="rounded-md bg-primary px-5 py-2.5 font-semibold text-cream hover:bg-primary-deep"
          >
            Edit member
          </Link>
        )}
      </div>

      <Card title="Contact">
        <Row label="Email">{m.email}</Row>
        <Row label="Phone">{m.phone}</Row>
        <Row label="Office phone">{m.officeTel}</Row>
        <Row label="Mailing address">{m.mailingAddress}</Row>
        <Row label="Registered address">{m.registeredAddress}</Row>
      </Card>

      <Card title="Membership">
        <Row label="Type">{`${typeFasal}: ${typeCategory}`}</Row>
        <Row label="Joined">{m.joinedDate}</Row>
        <Row label="Paid until">{m.expiryDate ? (m.expiryDate < today ? `${m.expiryDate} (ended)` : m.expiryDate) : null}</Row>
        <Row label="Previous number">{m.legacyMembershipNo}</Row>
        <Row label="Introduced by">{introducerName}</Row>
        <Row label="Data-protection consent">{m.pdpaConsentAt ? `Agreed on ${m.pdpaConsentAt.toISOString().slice(0, 10)}` : null}</Row>
      </Card>

      <Card title="Identity and business">
        <Row label="IC number">
          {m.icNo}
          {icHidden && m.icNo && <span className="ml-2 text-sm text-primary-deep/60">(hidden for your role)</span>}
        </Row>
        <Row label="SSM / registration no.">{m.ssmNo}</Row>
        <Row label="Business sector">{sectorName}</Row>
        <Row label="Business type">{businessTypeName}</Row>
      </Card>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-primary">Invoices</h2>
          <Link href={`/admin/invoices/new?member=${m.id}`} className="text-sm font-semibold text-primary underline">
            Create invoice
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="mt-3 rounded-md border border-line bg-paper px-5 py-4 text-primary-deep/75">No invoices yet.</p>
        ) : (
          <ul className="mt-3 rounded-md border border-line bg-paper">
            {invoices.map((inv) => (
              <li key={String(inv.id)} className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-5 py-3.5 last:border-b-0">
                <Link href={`/admin/invoices/${inv.id}`} className="font-semibold text-primary underline">{String(inv.invoice_no)}</Link>
                <span>{TYPE_LABEL[inv.invoice_type as InvoiceType] ?? String(inv.invoice_type)}</span>
                <span className="tabular-nums">{formatRM(String(inv.amount))}</span>
                <span className="text-sm tabular-nums text-primary-deep/75">due {String(inv.due_date)}</span>
                <span className="ml-auto"><InvoiceStatusBadge status={String(inv.status)} overdue={Boolean(inv.is_overdue)} /></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold text-primary">Membership periods</h2>
        {periods.length === 0 ? (
          <p className="mt-3 rounded-md border border-line bg-paper px-5 py-4 text-primary-deep/75">
            No paid period is recorded yet. One is added automatically when a renewal invoice is paid.
          </p>
        ) : (
          <ul className="mt-3 rounded-md border border-line bg-paper">
            {periods.map((per) => (
              <li key={`${per.period_start}-${per.period_end}`} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-line px-5 py-3.5 last:border-b-0">
                <span className="tabular-nums font-semibold text-primary">{String(per.period_start)} to {String(per.period_end)}</span>
                <span className="text-sm text-primary-deep/75">
                  {per.source === "invoice" && per.invoice_no ? `Paid on invoice ${per.invoice_no}` : per.source === "legacy_import" ? "Read from the old spreadsheet" : "Added by staff"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card title="Payment records from the old spreadsheet">
        <Row label="Receipt / period">{legacy.receiptNo}</Row>
        <Row label="Payment notes">{legacy.paymentNotes}</Row>
        <Row label="Last paid year">{m.legacyPaymentYear ? String(m.legacyPaymentYear) : null}</Row>
      </Card>

      {m.adminNotes && (
        <Card title="Internal notes">
          <Row label="Notes">{m.adminNotes}</Row>
        </Card>
      )}
    </>
  );
}
