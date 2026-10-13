import type { Metadata } from "next";
import { formatRM } from "@/lib/money";
import { requireUser } from "@/modules/auth/dal";
import { DPMM_LOGO_DATA_URI } from "@/lib/logo";
import { SignOutButton } from "@/modules/auth/sign-out-button";
import { InvoiceStatusBadge } from "@/modules/billing/invoice-status-badge";
import { getPortalMemberData } from "@/modules/portal/queries";

export const metadata: Metadata = { title: "Member portal" };
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const user = await requireUser("/portal");
  const data = await getPortalMemberData(user.id, user.email);

  return (
    <>
      <header className="border-b-4 border-accent bg-primary text-cream">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <img
            src={DPMM_LOGO_DATA_URI}
            alt="Dewan Perniagaan Melayu Malaysia (DPMM) Putrajaya"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-full bg-cream object-contain p-1"
          />
          <div className="leading-tight">
            <span className="block font-display text-xl font-semibold tracking-tight">
              DPMM Putrajaya
            </span>
            <span className="block text-xs font-medium text-cream/70">
              Dewan Perniagaan Melayu Malaysia
            </span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden text-sm text-cream/80 sm:inline">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="font-display text-4xl font-bold tracking-tight text-primary">Member portal</h1>
        {!data ? (
          <p role="status" className="mt-6 rounded-md border border-line bg-paper px-5 py-4 text-primary-deep">
            No membership record is linked to this account. Please sign in with the email address on your
            membership record or contact the DPMM Putrajaya secretariat.
          </p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold text-primary">{data.member.fullName}</h2>
                {data.member.companyName && <p className="mt-1">{data.member.companyName}</p>}
                <p className="mt-2 text-sm text-primary-deep/75">
                  {data.member.membershipNo} · {data.member.fasal} {data.member.category}
                </p>
              </div>
              <span className="rounded-full bg-primary px-3 py-1 text-sm font-semibold capitalize text-cream">
                {data.member.status}
              </span>
            </div>

            <section className="mt-8">
              <h2 className="font-display text-xl font-semibold text-primary">Membership details</h2>
              <dl className="mt-3 rounded-md border border-line bg-paper">
                <PortalRow label="Email">{data.member.email}</PortalRow>
                <PortalRow label="Phone">{data.member.phone}</PortalRow>
                <PortalRow label="Member since">{data.member.memberSince}</PortalRow>
                <PortalRow label="Expiry date">{data.member.expiryDate}</PortalRow>
                <PortalRow label="Business sector">{data.member.businessSector}</PortalRow>
                <PortalRow label="Business type">{data.member.businessType}</PortalRow>
                <PortalRow label="Mailing address">{data.member.mailingAddress}</PortalRow>
                <PortalRow label="Registered address">{data.member.registeredAddress}</PortalRow>
              </dl>
            </section>

            <section className="mt-8">
              <h2 className="font-display text-xl font-semibold text-primary">Invoices</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-line bg-paper px-5 py-4">
                  <p className="text-sm text-primary-deep/75">Open invoices</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{data.summary.openInvoices}</p>
                </div>
                <div className="rounded-md border border-line bg-paper px-5 py-4">
                  <p className="text-sm text-primary-deep/75">Outstanding balance</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">
                    {formatRM(data.summary.outstandingBalance)}
                  </p>
                </div>
              </div>
              {data.invoices.length === 0 ? (
                <p className="mt-3 rounded-md border border-line bg-paper px-5 py-4 text-primary-deep/75">
                  No invoices have been recorded for this membership.
                </p>
              ) : (
                <ul className="mt-3 rounded-md border border-line bg-paper">
                  {data.invoices.map((invoice) => (
                    <li
                      key={invoice.id}
                      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-5 py-3.5 last:border-b-0"
                    >
                      <div>
                        <p className="font-semibold text-primary">{invoice.invoiceNo}</p>
                        <p className="text-sm capitalize text-primary-deep/75">{invoice.type} · issued {invoice.issuedDate}</p>
                      </div>
                      <span className="tabular-nums">{formatRM(invoice.amount)}</span>
                      <span className="text-sm tabular-nums text-primary-deep/75">Due {invoice.dueDate}</span>
                      <span className="ml-auto">
                        <InvoiceStatusBadge status={invoice.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {data.invoices.length === 10 && (
                <p className="mt-2 text-sm text-primary-deep/75">Showing the 10 most recent invoices.</p>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}

function PortalRow({ label, children }: { label: string; children: string | null }) {
  return (
    <div className="grid gap-1 border-b border-line px-5 py-3.5 last:border-b-0 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <dt className="text-sm text-primary-deep/75">{label}</dt>
      <dd className="break-words text-primary-deep">{children || <span className="text-primary-deep/40">Not recorded</span>}</dd>
    </div>
  );
}
