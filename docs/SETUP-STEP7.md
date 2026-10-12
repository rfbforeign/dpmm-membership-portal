# Step 7: Renewals and email reminders

Every morning (9am Malaysia time) the system checks for members whose year is ending and members who owe money.
It creates renewal invoices, sends the emails, and marks lapsed members as Expired.

**Nothing changes and nothing is sent until you switch it on.** It starts in "dry run" mode.

## What happens each morning (live mode)

| When | What the system does | Email sent |
|---|---|---|
| 30 days before a member's paid period ends | Creates the renewal invoice (annual fee, starting the day after the current period) | "Your DPMM membership renewal", with the invoice and how to pay |
| 3 days before the due date | Nothing | Reminder: invoice due soon |
| The day after the due date | Nothing | Invoice overdue |
| 7 days after the due date | Nothing | Final reminder (no more after 30 days overdue) |
| The paid period ends | Marks the member Expired | "Your membership has expired" |

Also sent straight away when they happen: a confirmation to new applicants (with their invoice and how to pay),
and a receipt whenever a payment is recorded.

Each email is sent **once only**, however many times the job runs. Suspended members are never chased.

## Files

Unzip this bundle **on top of** your project folder (after Step 5c) and allow it to overwrite:
`src/app/admin/layout.tsx`, `src/modules/registration/actions.ts`, `src/modules/billing/actions.ts` and `vercel.json`
(if you already had a `vercel.json`, keep both entries: `regions` and `crons`).

No new packages. The database changes (`db/sql/0004_automation.sql`) are **already applied to both Neon branches**.

## Settings (environment variables)

Add these in your `.env.local` and in the Vercel project settings (see `.env.example.additions`):

| Name | What it is |
|---|---|
| `CRON_SECRET` | A long random string you make up. It protects the daily job so only Vercel can start it. **Required.** |
| `AUTOMATION_MODE` | Leave as `dry_run`. Only the exact word `live` makes it act. |
| `RESEND_API_KEY` | Resend API key. Required to send email. |
| `EMAIL_FROM` | Sender address using a domain verified with Resend, e.g. `DPMM Putrajaya <noreply@yourdomain.my>`. Required to send email. |
| `EMAIL_REPLY_TO` | Optional reply-to address. |
| `EMAIL_FORCE_SEND` | Leave unset. Setting this to `true` bypasses the production-only sending guard and can send real emails from Preview or Development. |

## How to switch it on safely

1. **Deploy and look.** Open **Renewals** in the admin bar. It shows what tomorrow's run *would* do. Today that is:
   create 10 renewal invoices, and mark 1 member Expired.
2. **Finish the paid-until review.** 214 members have no paid-until date and 16 Active members look lapsed
   (see `DPMM_PaidUntil_Review.xlsx`). Until then the system can only automate the 34 members whose dates are known.
   The automation deliberately ignores members who lapsed more than 45 days ago, so old data never triggers emails.
3. **Set up email.** Create a free account at resend.com, verify your sending domain (they show the DNS records to add),
   and create an API key. Put the key in `RESEND_API_KEY` and a sender like `DPMM Putrajaya <noreply@yourdomain.my>` in `EMAIL_FROM`. Optionally set `EMAIL_REPLY_TO` to an address that should receive replies. Leave `EMAIL_FORCE_SEND` unset.
   The free plan allows 100 emails a day, which is plenty. **Emails are sent only from the live website**, never from your computer or a preview site, unless `EMAIL_FORCE_SEND=true` is explicitly set (not recommended).
4. **Test.** Apply as a new member at `/register` using your own email address. The confirmation should arrive within a minute.
   Tell me afterwards and I will remove the test record.
5. **Go live.** Change `AUTOMATION_MODE` to `live` and redeploy. The first run creates the 10 renewal invoices and emails those members.

An administrator can also send a Resend configuration test with `POST /api/test-resend` on the production site. It uses the configured `EMAIL_FROM` sender and sends only to Resend's `delivered@resend.dev` test recipient; it does not deliver to a personal inbox.

## The Renewals page

- Shows whether automation is Live or Dry run, and whether email is ready.
- Previews the next run, and lists what needs a person (lapsed members to check, members with no paid-until date).
- Shows recent runs and every email with its status. Administrators can press "Send waiting emails now".
- A failed email is retried up to 3 times, an hour apart. Bad addresses are not retried.

## Good to know

- Emails are in English for now. Malay versions are easy to add.
- Vercel's free plan runs a daily job once a day, which is what this needs.
- Emails older than 14 days are never sent, because they would be out of date.
- Reminder timing is set in `src/modules/notifications/reminders.ts` (30-day lead, 45-day lookback, reminder stages).
