/** How the daily automation is tuned. Change these numbers to change the behaviour. */
export const RENEWAL_LEAD_DAYS = 30; // renewal invoice is created this many days before the paid period ends
export const EXPIRY_DELAY_DAYS = 365; // members are expired only after their paid period ended at least this many days ago
export const MAX_EMAILS_PER_RUN = 40; // keeps a run inside the time limit; the rest wait for the next run

export type ReminderStage = "due_soon" | "overdue_1" | "overdue_7";

// Each email has a unique key. The database refuses a second row with the same key,
// so a re-run, a retry or two overlapping runs can never send the same email twice.
export const registrationKey = (membershipNo: string) => `registration:${membershipNo}`;
export const invoiceIssuedKey = (invoiceId: string) => `invoice_issued:${invoiceId}`;
export const reminderKey = (invoiceId: string, stage: ReminderStage) => `reminder:${invoiceId}:${stage}`;
export const expiredKey = (memberId: string, expiryDate: string) => `membership_expired:${memberId}:${expiryDate}`;
export const receiptKey = (receiptNo: string) => `receipt:${receiptNo}`;
