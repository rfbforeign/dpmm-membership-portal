import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";
import { sendQueuedNow } from "@/modules/notifications/actions";
import { previewAutomation } from "@/modules/notifications/automation";
import { getNotificationOverview, STATUS_FILTERS } from "@/modules/notifications/queries";
import { EXPIRY_LOOKBACK_DAYS, RENEWAL_LEAD_DAYS } from "@/modules/notifications/reminders";

export const metadata: Metadata = { title: "Renewals and emails" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  registration: "Application received",
  invoice: "Renewal invoice",
  renewal_reminder: "Payment reminder",
  payment_receipt: "Receipt",
  alert: "Membership expired",
};

const STAGE_LABEL: Record<string, string> = {
  due_soon: "due soon",
  overdue_1: "overdue",
  overdue_7: "final reminder",
};

const SKIPPED_TEXT: Record<string, string> = {
  email_not_configured: "Email is not set up yet, so nothing was sent.",
  not_production: "Emails are only sent from the live website, so nothing was sent from here.",
};

function Names({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <span className="text-primary-deep/60">{empty}</span>;
  const shown = items.slice(0, 12).join(", ");
  return (
    <span className="tabular-nums">
      {shown}
      {items.length > 12 ? `, and ${items.length - 12} more` : ""}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const style =
    status === "sent" ? "bg-primary text-cream" : status === "failed" ? "bg-accent text-white" : "border border-primary text-primary";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>{status}</span>;
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; attempted?: string; sent?: string; failed?: string; skipped?: string }>;
}) {
  const flags = await searchParams;
  const user = await requireRole(STAFF_ROLES, "/admin/notifications");
  const [overview, preview] = await Promise.all([getNotificationOverview(flags.status), previewAutomation()]);
  const isAdmin = user.role === "admin";

  const emailState = !preview.email.configured
    ? "Not set up yet. Emails are queued but not sent."
    : !preview.email.sendingAllowed
      ? "Set up. Emails are sent only from the live website, not from a test copy."
      : "Ready. Queued emails are sent automatically.";

  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight text-primary">Renewals and emails</h1>

      {flags.attempted !== undefined && (
        <p role="status" className="mt-4 border-l-4 border-primary bg-paper px-4 py-3 text-sm">
          {flags.skipped
            ? (SKIPPED_TEXT[flags.skipped] ?? "Nothing was sent.")
            : `Tried ${flags.attempted} email(s): ${flags.sent} sent, ${flags.failed} failed.`}
        </p>
      )}

      <section className="mt-8" aria-labelledby="status-heading">
        <h2 id="status-heading" className="font-display text-xl font-semibold text-primary">Status</h2>
        <dl className="mt-3 rounded-md border border-line bg-paper">
          <div className="grid gap-1 border-b border-line px-5 py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="text-sm text-primary-deep/75">Daily automation</dt>
            <dd>
              {preview.mode === "live" ? (
                <strong className="text-primary">Live.</strong>
              ) : (
                <strong className="text-accent">Dry run.</strong>
              )}{" "}
              {preview.mode === "live"
                ? "It runs every morning and makes the changes listed below."
                : "It runs every morning but only reports what it would do. Nothing is changed or sent."}
            </dd>
          </div>
          <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="text-sm text-primary-deep/75">Email</dt>
            <dd>{emailState}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="next-heading">
        <h2 id="next-heading" className="font-display text-xl font-semibold text-primary">What the next run would do</h2>
        <dl className="mt-3 rounded-md border border-line bg-paper">
          <div className="grid gap-1 border-b border-line px-5 py-3.5 sm:grid-cols-[16rem_1fr] sm:gap-4">
            <dt>Mark as Expired <span className="block text-sm text-primary-deep/70">paid period ended in the last {EXPIRY_LOOKBACK_DAYS} days</span></dt>
            <dd><Names items={preview.willExpire.map((m) => m.membershipNo)} empty="None" /></dd>
          </div>
          <div className="grid gap-1 border-b border-line px-5 py-3.5 sm:grid-cols-[16rem_1fr] sm:gap-4">
            <dt>Create renewal invoices <span className="block text-sm text-primary-deep/70">paid period ends within {RENEWAL_LEAD_DAYS} days</span></dt>
            <dd><Names items={preview.renewalInvoices.map((m) => m.membershipNo)} empty="None" /></dd>
          </div>
          <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[16rem_1fr] sm:gap-4">
            <dt>Send payment reminders <span className="block text-sm text-primary-deep/70">unpaid invoices</span></dt>
            <dd><Names items={preview.reminders.map((r) => `${r.invoiceNo} (${STAGE_LABEL[r.stage]})`)} empty="None" /></dd>
          </div>
        </dl>

        {(preview.needsReview > 0 || preview.activeWithoutDate > 0) && (
          <div className="mt-4 border-l-4 border-accent bg-paper px-5 py-4">
            <p className="font-semibold text-primary">Needs a person</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {preview.needsReview > 0 && (
                <li>
                  <strong>{preview.needsReview}</strong> Active members had a paid period that ended more than {EXPIRY_LOOKBACK_DAYS} days ago. The
                  automation leaves them alone. Check whether they renewed.
                </li>
              )}
              {preview.activeWithoutDate > 0 && (
                <li>
                  <strong>{preview.activeWithoutDate}</strong> Active members have no paid-until date, so no renewal can be scheduled for them. The
                  paid-until workbook is for this.
                </li>
              )}
            </ul>
          </div>
        )}
      </section>

      {overview.runs.length > 0 && (
        <section className="mt-10" aria-labelledby="runs-heading">
          <h2 id="runs-heading" className="font-display text-xl font-semibold text-primary">Recent runs</h2>
          <div className="mt-3 overflow-x-auto rounded-md border border-line bg-paper">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-primary">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Started</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Mode</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Result</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">What happened</th>
                </tr>
              </thead>
              <tbody>
                {overview.runs.map((run, i) => {
                  const s = (run.summary ?? {}) as Record<string, unknown>;
                  const invoices = Array.isArray(s.renewalInvoicesCreated) ? s.renewalInvoicesCreated.length : 0;
                  const expired = Array.isArray(s.expired) ? s.expired.length : 0;
                  return (
                    <tr key={i} className="border-b border-line last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{String(run.started)}</td>
                      <td className="px-4 py-2.5">{run.mode === "live" ? "Live" : "Dry run"}</td>
                      <td className="px-4 py-2.5">{String(run.status)}</td>
                      <td className="px-4 py-2.5">
                        {run.error
                          ? String(run.error)
                          : run.mode === "live"
                            ? `${expired} expired, ${invoices} renewal invoice(s), ${Number(s.emailsQueued ?? 0)} email(s) queued`
                            : "Reported only"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-10" aria-labelledby="emails-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="emails-heading" className="font-display text-xl font-semibold text-primary">Emails</h2>
          {isAdmin && (
            <form action={sendQueuedNow}>
              <button type="submit" className="rounded-md border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-paper">
                Send waiting emails now
              </button>
            </form>
          )}
        </div>

        <nav aria-label="Filter emails" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/admin/notifications"
            aria-current={!overview.status ? "page" : undefined}
            className={`rounded-full border px-3 py-1 font-semibold ${!overview.status ? "border-primary bg-primary text-cream" : "border-line bg-paper text-primary"}`}
          >
            All
          </Link>
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={`/admin/notifications?status=${s}`}
              aria-current={overview.status === s ? "page" : undefined}
              className={`rounded-full border px-3 py-1 font-semibold ${overview.status === s ? "border-primary bg-primary text-cream" : "border-line bg-paper text-primary"}`}
            >
              {s[0].toUpperCase() + s.slice(1)} ({overview.byStatus[s] ?? 0})
            </Link>
          ))}
        </nav>
        {overview.stale > 0 && (
          <p className="mt-3 text-sm text-primary-deep/75">
            {overview.stale} queued email(s) are more than 14 days old and will not be sent, because they are out of date.
          </p>
        )}

        {overview.recent.length === 0 ? (
          <p className="mt-4 rounded-md border border-line bg-paper px-5 py-4 text-primary-deep/75">No emails yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border border-line bg-paper">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <caption className="sr-only">Most recent emails</caption>
              <thead>
                <tr className="border-b border-line text-primary">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Queued</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Type</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">To</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Subject</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.recent.map((n) => (
                  <tr key={String(n.id)} className="border-b border-line align-top last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{String(n.created)}</td>
                    <td className="px-4 py-2.5">{TYPE_LABEL[String(n.type)] ?? String(n.type)}</td>
                    <td className="px-4 py-2.5">
                      {n.member_id ? (
                        <Link href={`/admin/members/${n.member_id}`} className="font-semibold text-primary underline">{String(n.full_name)}</Link>
                      ) : (
                        "-"
                      )}
                      <span className="block text-primary-deep/75">{String(n.recipient)}</span>
                    </td>
                    <td className="px-4 py-2.5">{String(n.subject ?? "")}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={String(n.status)} />
                      {n.sent && <span className="mt-1 block text-xs tabular-nums text-primary-deep/70">{String(n.sent)}</span>}
                      {n.error && <span className="mt-1 block text-xs text-accent">{String(n.error)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
