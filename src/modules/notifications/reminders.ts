/** How the daily automation is tuned. Change these numbers to change the behaviour. */
export const RENEWAL_LEAD_DAYS = 30; // renewal invoice is created this many days before the paid period ends
export const EXPIRY_LOOKBACK_DAYS = 45; // only members who lapsed within this many days are expired and emailed
export const MAX_EMAILS_PER_RUN = 40; // keeps a run inside the time limit; the rest wait for the next run

export type ReminderStage = "due_soon" | "overdue_1" | "overdue_7";

/**
 * Which reminder, if any, an unpaid invoice is due for.
 * `daysToDue` is the due date minus today: 3 means due in 3 days, -2 means 2 days overdue.
 * Ranges (not exact days) mean a missed run still catches up, and the unique keys below keep it to one email.
 * Invoices more than 30 days overdue get no automatic emails; a person should follow those up.
 */
export function classifyReminderStage(daysToDue: number): ReminderStage | null {
  if (daysToDue >= 0 && daysToDue <= 3) return "due_soon";
  if (daysToDue <= -1 && daysToDue >= -6) return "overdue_1";
  if (daysToDue <= -7 && daysToDue >= -30) return "overdue_7";
  return null;
}

// Each email has a unique key. The database refuses a second row with the same key,
// so a re-run, a retry or two overlapping runs can never send the same email twice.
export const registrationKey = (membershipNo: string) => `registration:${membershipNo}`;
export const invoiceIssuedKey = (invoiceId: string) => `invoice_issued:${invoiceId}`;
export const reminderKey = (invoiceId: string, stage: ReminderStage) => `reminder:${invoiceId}:${stage}`;
export const expiredKey = (memberId: string, expiryDate: string) => `membership_expired:${memberId}:${expiryDate}`;
export const receiptKey = (receiptNo: string) => `receipt:${receiptNo}`;
