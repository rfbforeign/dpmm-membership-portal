import { getSql } from "@/db";
import { todayInMalaysia } from "@/lib/normalize";
import { getEmailConfig, sendingAllowed } from "./resend";
import { enqueueNotification, sendQueued, type SendSummary } from "./outbox";
import {
  classifyReminderStage,
  EXPIRY_LOOKBACK_DAYS,
  expiredKey,
  invoiceIssuedKey,
  MAX_EMAILS_PER_RUN,
  reminderKey,
  RENEWAL_LEAD_DAYS,
  type ReminderStage,
} from "./reminders";
import { renderEmail, type MailContext } from "./templates";

export type AutomationMode = "dry_run" | "live";

/** Nothing changes unless AUTOMATION_MODE is exactly "live". */
export function getAutomationMode(env: Record<string, string | undefined> = process.env): AutomationMode {
  return env.AUTOMATION_MODE === "live" ? "live" : "dry_run";
}

// ---------------------------------------------------------------------------
// What is due (read-only)
// ---------------------------------------------------------------------------

interface DueReminder {
  invoiceId: string;
  stage: ReminderStage;
  memberId: string;
  email: string;
  ctx: MailContext;
}

async function findDueReminders(): Promise<DueReminder[]> {
  const rows = await getSql().query(
    `SELECT s.id AS invoice_id, s.invoice_no, s.amount::text AS amount, s.balance::text AS balance, s.due_date::text AS due_date,
            (s.due_date - my_today()) AS days_to_due,
            m.id AS member_id, m.full_name, m.email, m.membership_no
     FROM invoice_summary s JOIN members m ON m.id = s.member_id
     WHERE s.status = 'unpaid' AND s.issued_date < my_today()
       AND m.deleted_at IS NULL AND m.status <> 'suspended'
       AND (s.due_date - my_today()) BETWEEN -30 AND 3
     ORDER BY s.due_date, s.invoice_no`
  );
  const due: DueReminder[] = [];
  for (const r of rows) {
    const stage = classifyReminderStage(Number(r.days_to_due));
    if (!stage) continue;
    due.push({
      invoiceId: String(r.invoice_id),
      stage,
      memberId: String(r.member_id),
      email: String(r.email),
      ctx: {
        memberName: String(r.full_name),
        membershipNo: String(r.membership_no),
        invoiceNo: String(r.invoice_no),
        amount: String(r.amount),
        balance: String(r.balance),
        dueDate: String(r.due_date),
        stage,
      },
    });
  }
  return due;
}

export interface Preview {
  mode: AutomationMode;
  email: { configured: boolean; sendingAllowed: boolean };
  willExpire: { membershipNo: string; expiredOn: string }[];
  renewalInvoices: { membershipNo: string; expiresOn: string }[];
  reminders: { invoiceNo: string; stage: ReminderStage }[];
  needsReview: number; // active, but their paid period ended before the lookback window
  activeWithoutDate: number; // active, and no paid-until date is known, so nothing can be automated
}

/** What the next live run would do. Changes nothing. Contains membership numbers only. */
export async function previewAutomation(): Promise<Preview> {
  const sql = getSql();
  const [expire, candidates, due, [review], [noDate]] = await Promise.all([
    sql.query(`SELECT out_membership_no, out_expiry_date::text AS expired_on FROM automation_expire_members($1, false)`, [EXPIRY_LOOKBACK_DAYS]),
    sql.query(`SELECT out_membership_no, out_expiry_date::text AS expires_on FROM automation_renewal_candidates($1)`, [RENEWAL_LEAD_DAYS]),
    findDueReminders(),
    sql.query(
      `SELECT count(*)::int AS n FROM members WHERE deleted_at IS NULL AND status = 'active' AND expiry_date < my_today() - $1::int`,
      [EXPIRY_LOOKBACK_DAYS]
    ),
    sql.query(`SELECT count(*)::int AS n FROM members WHERE deleted_at IS NULL AND status = 'active' AND expiry_date IS NULL`),
  ]);

  // Leave out reminders that have already been queued, so the preview shows only new work
  const keys = due.map((d) => reminderKey(d.invoiceId, d.stage));
  const already = keys.length
    ? new Set((await sql.query(`SELECT dedupe_key FROM notification_logs WHERE dedupe_key = ANY($1::text[])`, [keys])).map((r) => String(r.dedupe_key)))
    : new Set<string>();

  return {
    mode: getAutomationMode(),
    email: { configured: getEmailConfig() !== null, sendingAllowed: sendingAllowed() },
    willExpire: expire.map((r) => ({ membershipNo: String(r.out_membership_no), expiredOn: String(r.expired_on) })),
    renewalInvoices: candidates.map((r) => ({ membershipNo: String(r.out_membership_no), expiresOn: String(r.expires_on) })),
    reminders: due
      .filter((d) => !already.has(reminderKey(d.invoiceId, d.stage)))
      .map((d) => ({ invoiceNo: d.ctx.invoiceNo ?? "", stage: d.stage })),
    needsReview: Number(review?.n ?? 0),
    activeWithoutDate: Number(noDate?.n ?? 0),
  };
}

// ---------------------------------------------------------------------------
// The daily run
// ---------------------------------------------------------------------------

export interface RunSummary {
  status: "done" | "skipped" | "failed";
  mode: AutomationMode;
  reason?: string;
  expired: string[]; // membership numbers
  renewalInvoicesCreated: string[]; // invoice numbers
  renewalInvoiceErrors: string[]; // membership numbers that failed
  emailsQueued: number;
  emails: SendSummary;
  needsReview: number;
  activeWithoutDate: number;
}

const emptySend: SendSummary = { attempted: 0, sent: 0, failed: 0 };

export async function runDailyAutomation(mode: AutomationMode): Promise<RunSummary> {
  const sql = getSql();
  const today = todayInMalaysia();

  const summary: RunSummary = {
    status: "done",
    mode,
    expired: [],
    renewalInvoicesCreated: [],
    renewalInvoiceErrors: [],
    emailsQueued: 0,
    emails: emptySend,
    needsReview: 0,
    activeWithoutDate: 0,
  };

  // A run that never finished (crashed or timed out) must not block the day
  await sql.query(
    `UPDATE automation_runs SET status = 'failed', finished_at = now(), error = 'Timed out' WHERE status = 'running' AND started_at < now() - interval '15 minutes'`
  );

  // One live run a day: the database refuses a second one
  const started = await sql.query(
    `INSERT INTO automation_runs (run_date, mode) VALUES ($1::date, $2)
     ON CONFLICT (run_date) WHERE mode = 'live' AND status IN ('running', 'done') DO NOTHING
     RETURNING id`,
    [today, mode]
  );
  if (started.length === 0) return { ...summary, status: "skipped", reason: "A live run has already happened today." };
  const runId = Number(started[0].id);

  try {
    if (mode === "dry_run") {
      const preview = await previewAutomation();
      summary.expired = preview.willExpire.map((m) => m.membershipNo);
      summary.needsReview = preview.needsReview;
      summary.activeWithoutDate = preview.activeWithoutDate;
      summary.reason = "Dry run: nothing was changed or sent.";
    } else {
      await liveRun(summary);
    }

    await sql.query(`UPDATE automation_runs SET status = 'done', finished_at = now(), summary = $2::jsonb WHERE id = $1`, [
      runId,
      JSON.stringify(summary),
    ]);
    return summary;
  } catch (error) {
    console.error("Daily automation failed", error);
    const message = error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
    await sql.query(`UPDATE automation_runs SET status = 'failed', finished_at = now(), error = $2, summary = $3::jsonb WHERE id = $1`, [
      runId,
      message,
      JSON.stringify(summary),
    ]);
    return { ...summary, status: "failed", reason: "The run stopped part-way. Nothing already done is undone, and the next run continues safely." };
  }
}

async function liveRun(summary: RunSummary): Promise<void> {
  const sql = getSql();

  // 1. Members whose paid period recently ended become Expired, and are told
  const expired = await sql.query(`SELECT out_member_id, out_membership_no, out_expiry_date::text AS expiry_date FROM automation_expire_members($1, true)`, [
    EXPIRY_LOOKBACK_DAYS,
  ]);
  for (const e of expired) {
    summary.expired.push(String(e.out_membership_no));
    const [m] = await sql.query(
      `SELECT m.full_name, m.email,
              (SELECT invoice_no FROM invoice_summary WHERE member_id = m.id AND status = 'unpaid' AND invoice_type = 'renewal' ORDER BY created_at DESC LIMIT 1) AS invoice_no,
              (SELECT balance::text FROM invoice_summary WHERE member_id = m.id AND status = 'unpaid' AND invoice_type = 'renewal' ORDER BY created_at DESC LIMIT 1) AS balance
       FROM members m WHERE m.id = $1::uuid`,
      [e.out_member_id]
    );
    if (!m) continue;
    const mail = renderEmail("membership_expired", {
      memberName: String(m.full_name),
      membershipNo: String(e.out_membership_no),
      expiryDate: String(e.expiry_date),
      invoiceNo: m.invoice_no ? String(m.invoice_no) : undefined,
      balance: m.balance ? String(m.balance) : undefined,
    });
    const id = await enqueueNotification({
      memberId: String(e.out_member_id),
      type: "alert",
      recipient: String(m.email),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      dedupeKey: expiredKey(String(e.out_member_id), String(e.expiry_date)),
    });
    if (id) summary.emailsQueued++;
  }

  // 2. Members whose year is nearly up get their renewal invoice, and an email
  const candidates = await sql.query(`SELECT out_member_id, out_membership_no FROM automation_renewal_candidates($1)`, [RENEWAL_LEAD_DAYS]);
  for (const c of candidates) {
    try {
      const [inv] = await sql.query(
        `SELECT out_invoice_id, out_invoice_no, out_amount::text AS amount, out_period_start::text AS period_start,
                out_period_end::text AS period_end, out_due_date::text AS due_date
         FROM create_renewal_invoice($1::uuid)`,
        [c.out_member_id]
      );
      summary.renewalInvoicesCreated.push(String(inv.out_invoice_no));
      const [m] = await sql.query(`SELECT full_name, email, expiry_date::text AS expiry_date FROM members WHERE id = $1::uuid`, [c.out_member_id]);
      const mail = renderEmail("invoice_issued", {
        memberName: String(m.full_name),
        membershipNo: String(c.out_membership_no),
        invoiceNo: String(inv.out_invoice_no),
        amount: String(inv.amount),
        dueDate: String(inv.due_date),
        periodStart: String(inv.period_start),
        periodEnd: String(inv.period_end),
        expiryDate: m.expiry_date ? String(m.expiry_date) : undefined,
      });
      const id = await enqueueNotification({
        memberId: String(c.out_member_id),
        invoiceId: String(inv.out_invoice_id),
        type: "invoice",
        recipient: String(m.email),
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        dedupeKey: invoiceIssuedKey(String(inv.out_invoice_id)),
      });
      if (id) summary.emailsQueued++;
    } catch (error) {
      // One member's problem must not stop everyone else's renewal
      console.error("Renewal invoice failed for", c.out_membership_no, error);
      summary.renewalInvoiceErrors.push(String(c.out_membership_no));
    }
  }

  // 3. Payment reminders for unpaid invoices
  for (const d of await findDueReminders()) {
    const mail = renderEmail("payment_reminder", d.ctx);
    const id = await enqueueNotification({
      memberId: d.memberId,
      invoiceId: d.invoiceId,
      type: "renewal_reminder",
      recipient: d.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      dedupeKey: reminderKey(d.invoiceId, d.stage),
    });
    if (id) summary.emailsQueued++;
  }

  // 4. Send what is waiting (does nothing until email is set up on the live site)
  summary.emails = await sendQueued(MAX_EMAILS_PER_RUN);

  const preview = await previewAutomation();
  summary.needsReview = preview.needsReview;
  summary.activeWithoutDate = preview.activeWithoutDate;
}

