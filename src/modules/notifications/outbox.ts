import { getSql } from "@/db";
import { getEmailConfig, sendEmail, sendingAllowed } from "./resend";

export type NotificationType = "registration" | "renewal_reminder" | "invoice" | "payment_receipt" | "alert";

export interface NewNotification {
  memberId: string | null;
  invoiceId?: string | null;
  type: NotificationType;
  recipient: string;
  subject: string;
  text: string;
  html: string;
  /** Unique per email. A second attempt to queue the same key is ignored. */
  dedupeKey: string;
}

/** Puts an email in the queue. Returns the new id, or null when this email was already queued before. */
export async function enqueueNotification(n: NewNotification): Promise<string | null> {
  const rows = await getSql()(
    `INSERT INTO notification_logs (member_id, invoice_id, type, channel, recipient, subject, message, body_html, status, dedupe_key)
     VALUES ($1::uuid, $2::uuid, $3::notification_type, 'email', $4, $5, $6, $7, 'queued', $8)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [n.memberId, n.invoiceId ?? null, n.type, n.recipient, n.subject, n.text, n.html, n.dedupeKey]
  );
  return rows.length > 0 ? String(rows[0].id) : null;
}

export interface SendSummary {
  attempted: number;
  sent: number;
  failed: number;
  /** Set when nothing was tried, and why. */
  skipped?: "email_not_configured" | "not_production";
}

const MAX_ATTEMPTS = 3;
const PAUSE_MS = 600; // the email service allows only a couple of requests a second

/**
 * Sends waiting emails, oldest first. Safe to call from anywhere, any time:
 *  - does nothing unless email is configured AND this is the live website
 *  - a message being sent is hidden from other runs for 10 minutes, so it cannot go out twice
 *  - failed messages are retried an hour later, up to 3 attempts, unless the failure is permanent
 *  - messages older than 14 days are treated as stale and are not sent
 */
export async function sendQueued(limit: number): Promise<SendSummary> {
  const config = getEmailConfig();
  if (!config) return { attempted: 0, sent: 0, failed: 0, skipped: "email_not_configured" };
  if (!sendingAllowed()) return { attempted: 0, sent: 0, failed: 0, skipped: "not_production" };

  const sql = getSql();
  const claimed = await sql(
    `UPDATE notification_logs SET attempts = attempts + 1, last_attempt_at = now()
     WHERE id IN (
       SELECT id FROM notification_logs
       WHERE channel = 'email' AND created_at > now() - interval '14 days'
         AND ( (status = 'queued' AND (last_attempt_at IS NULL OR last_attempt_at < now() - interval '10 minutes'))
            OR (status = 'failed' AND attempts < ${MAX_ATTEMPTS} AND last_attempt_at < now() - interval '1 hour') )
       ORDER BY created_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, recipient, subject, message, body_html`,
    [limit]
  );

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < claimed.length; i++) {
    const row = claimed[i];
    const result = await sendEmail(config, {
      to: String(row.recipient),
      subject: String(row.subject ?? ""),
      text: String(row.message ?? ""),
      html: row.body_html ? String(row.body_html) : null,
      idempotencyKey: String(row.id),
    });

    if (result.ok) {
      sent++;
      await sql(
        `UPDATE notification_logs SET status = 'sent', sent_at = now(), provider_message_id = $2, error = NULL WHERE id = $1::uuid`,
        [row.id, result.id]
      );
    } else {
      failed++;
      // A permanent failure (bad address, rejected message) uses up all attempts so it is not retried
      await sql(
        `UPDATE notification_logs SET status = 'failed', error = $2, attempts = CASE WHEN $3 THEN attempts ELSE GREATEST(attempts, ${MAX_ATTEMPTS}) END
         WHERE id = $1::uuid`,
        [row.id, result.error, result.retryable]
      );
    }
    if (i < claimed.length - 1) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }

  return { attempted: claimed.length, sent, failed };
}
