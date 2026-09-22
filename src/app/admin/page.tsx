import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";
import { getDashboardMetrics } from "@/modules/dashboard/queries";
import { formatRM } from "@/lib/money";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const count = new Intl.NumberFormat("en-MY");

export default async function DashboardPage() {
  await requireRole(STAFF_ROLES, "/admin");
  const m = await getDashboardMetrics();

  const segments = [
    { label: "Active", value: m.activeMembers, bar: "bg-primary" },
    { label: "Pending", value: m.pendingMembers, bar: "bg-primary/35" },
    { label: "Expired", value: m.expiredMembers, bar: "bg-accent" },
    { label: "Suspended", value: m.suspendedMembers, bar: "bg-primary-deep/60" },
  ];
  const total = Math.max(m.totalMembers, 1);

  const billing = [
    { label: "Revenue collected", value: formatRM(m.totalRevenue) },
    { label: "Total invoiced", value: formatRM(m.totalInvoiced) },
    { label: "Outstanding", value: formatRM(m.outstandingAmount) },
    { label: "Unpaid invoices", value: count.format(m.unpaidInvoices) },
    { label: "Overdue invoices", value: count.format(m.overdueInvoices), alert: m.overdueInvoices > 0 },
  ];

  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight text-primary">Dashboard</h1>

      <section aria-labelledby="members-heading" className="mt-10">
        <h2 id="members-heading" className="font-display text-xl font-semibold text-primary">
          Members
        </h2>

        <p className="mt-4 font-display text-6xl font-bold tabular-nums tracking-tight text-primary">
          {count.format(m.totalMembers)}
          <span className="ml-3 text-lg font-medium text-primary-deep/70">in total</span>
        </p>

        <div
          role="img"
          aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}
          className="mt-5 flex h-3 overflow-hidden rounded-full bg-line"
        >
          {segments.map((s) => (
            <div key={s.label} className={s.bar} style={{ width: `${(s.value / total) * 100}%` }} />
          ))}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {segments.map((s) => (
            <div key={s.label}>
              <dt className="flex items-center gap-2 text-sm">
                <span aria-hidden="true" className={`h-3 w-3 rounded-sm ${s.bar}`} />
                {s.label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-primary">
                {count.format(s.value)}
              </dd>
            </div>
          ))}
        </dl>

        {m.pendingMembers > 0 && (
          <p className="mt-6">
            <Link href="/admin/members?status=pending" className="font-semibold text-primary underline">
              Review {count.format(m.pendingMembers)} pending {m.pendingMembers === 1 ? "application" : "applications"}
            </Link>
          </p>
        )}
      </section>

      <section aria-labelledby="billing-heading" className="mt-14">
        <h2 id="billing-heading" className="font-display text-xl font-semibold text-primary">
          Billing
        </h2>

        <dl className="mt-4 max-w-xl rounded-md border border-line bg-paper">
          {billing.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between border-b border-line px-5 py-3.5 last:border-b-0"
            >
              <dt>{row.label}</dt>
              <dd
                className={`text-lg font-semibold tabular-nums ${row.alert ? "text-accent" : "text-primary"}`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-primary-deep/70">
          Billing figures start at zero until invoices and payments are recorded.
        </p>
      </section>
    </>
  );
}
