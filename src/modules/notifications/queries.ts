import { getSql } from "@/db";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";

export const STATUS_FILTERS = ["queued", "sent", "failed"] as const;

export interface NotificationRunRow {
  started: unknown;
  mode: unknown;
  status: unknown;
  summary: unknown;
  error: unknown;
}

export interface NotificationLogRow {
  id: unknown;
  type: unknown;
  recipient: unknown;
  subject: unknown;
  status: unknown;
  error: string | null;
  sent: string | null;
  created: unknown;
  member_id: unknown;
  full_name: unknown;
}

/** Staff only. Everything the notifications page shows, in one go. */
export async function getNotificationOverview(rawStatus?: string) {
  await requireRole(STAFF_ROLES);
  const status = STATUS_FILTERS.find((s) => s === rawStatus);
  const sql = getSql();

  const [counts, [stale], recent, runs] = await Promise.all([
    sql(`SELECT status::text AS status, count(*)::int AS n FROM notification_logs GROUP BY status`),
    sql(`SELECT count(*)::int AS n FROM notification_logs WHERE status = 'queued' AND created_at <= now() - interval '14 days'`),
    sql(
      `SELECT n.id, n.type::text AS type, n.recipient, n.subject, n.status::text AS status, n.error, n.attempts,
              to_char(n.created_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI') AS created,
              to_char(n.sent_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI') AS sent,
              m.id AS member_id, m.full_name, m.membership_no
       FROM notification_logs n LEFT JOIN members m ON m.id = n.member_id
       WHERE ($1::text IS NULL OR n.status::text = $1)
       ORDER BY n.created_at DESC LIMIT 50`,
      [status ?? null]
    ),
    sql(
      `SELECT run_date::text AS run_date, mode, status,
              to_char(started_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI') AS started, summary, error
       FROM automation_runs ORDER BY id DESC LIMIT 5`
    ),
  ]);

  const byStatus: Record<string, number> = { queued: 0, sent: 0, failed: 0 };
  for (const c of counts) byStatus[String(c.status)] = Number(c.n);

  return {
    status,
    byStatus,
    stale: Number(stale?.n ?? 0),
    recent: recent as NotificationLogRow[],
    runs: runs as NotificationRunRow[],
  };
}
