# Step 7: Renewals and email notifications

Every morning at 9am Malaysia time, the scheduled job checks active members' paid-period dates. In live mode,
it creates renewal invoices for upcoming expiries and marks members Expired once their paid period ended at
least 365 days ago. Automatic payment reminders are disabled.

The daily automation starts in `dry_run` mode. In that mode, it does not create renewal invoices, change membership
statuses, or send automation emails; it does record the run in the automation log. Registration confirmations and
payment receipts are separate event-triggered emails and can be sent when email delivery is configured, even while
the daily automation is in dry-run mode.

## What happens each morning (live mode)

## Scheduled trigger timeline

| When | What the system does | Email sent |
|---|---|---|
| Within 30 days before a member's paid period ends | Creates the renewal invoice (annual fee, starting the day after the current period) | "Your DPMM membership renewal", with the invoice and how to pay |
| Invoice due within 3 days (including the due date) | Nothing | No automatic reminder |
| 1–6 days overdue | Nothing | No automatic reminder |
| 7–30 days overdue | Nothing | No automatic reminder |
| 365 days after the paid period ends | Marks the member Expired | "Your membership has expired" |

## Event-Driven Queued Emails

- **New Application Confirmation:** Triggered immediately upon new sign-up, sending an acknowledgment along with their initial invoice and payment details.
- **Payment Receipt:** Triggered whenever a payment is successfully recorded in the system.

*Note: Both event-driven emails can send immediately once production email delivery is active.*

## Operational Guardrails

- **Idempotency:** Each distinct queued notification uses a deduplication key so reruns do not enqueue it again.
- **Suspension suppression:** Suspended members are excluded from renewal invoice and expiry automation.

## Files

No new packages are required. Apply database migrations `0004` through `0006` to each Neon branch used by the app.
In particular, apply `db/sql/0005_email_template_variables.sql` and `db/sql/0006_automation_schedule.sql` to
Neon Production **before deploying** this application change. Migration `0006` updates the expiry schedule and
closes previously queued payment reminders.

## Settings (environment variables)

Add these in your `.env.local` and in the Vercel project settings. The variable names are also listed in
[`.env.example`](../.env.example).

| Name | What it is |
|---|---|
| `CRON_SECRET` | A long random string you make up. It protects the daily job so only Vercel can start it. **Required.** |
| `AUTOMATION_MODE` | Leave as `dry_run`. Only the exact word `live` makes it act. |
| `RESEND_API_KEY` | Resend API key. Required to send email. |
| `EMAIL_FROM` | Sender address using a domain verified with Resend, e.g. `DPMM Putrajaya <noreply@yourdomain.my>`. Required to send email. |
| `EMAIL_REPLY_TO` | Optional reply-to address. |
| `RESEND_MEMBER_TEMPLATE_ID` | Optional. Set to `479cd403-4f33-4efd-978d-17ceedc860f8` to send member email through the published shared template. Migration `0005` is required by this app version and must be applied before deploying it, whether or not this variable is set. |
| `EMAIL_FORCE_SEND` | Leave unset. Setting this to `true` bypasses the production-only sending guard and can send real emails from Preview or Development. |

## How to switch it on safely

1. **Review the data first.** Check the **Renewals** page in the admin area. Its preview shows the current proposed work, active members waiting for the 365-day expiry threshold, and active members without a known paid-until date. Counts change as the database changes.
2. **Set up email.** In Resend, verify the sending domain and create an API key. In Vercel, set `RESEND_API_KEY`, `EMAIL_FROM` (for this app, `DPMM <noreply@sistem.rfbmalaysia.com>`), and, if desired, `EMAIL_REPLY_TO` (currently `dpmm.putarajaya@gmail.com`). Set `RESEND_MEMBER_TEMPLATE_ID` to the published template ID above to use the shared template. Leave `EMAIL_FORCE_SEND` unset; it bypasses the production-only sending guard.
3. **Apply the production migrations before deployment.** Apply `db/sql/0005_email_template_variables.sql` and `db/sql/0006_automation_schedule.sql` to Neon Production before deploying. Confirm the migrations and Vercel settings are in place, then deploy.
4. **Test email.** The administrator-only `POST /api/test-resend` endpoint sends a basic Resend test to `admindpmm@rfbmalaysia.com`; it does not test the shared member template. To test the member email/template path, submit a controlled application at `/register` using an email address you can access. This creates a real application record, so plan its review/removal through the normal admin process.
5. **Go live only after review.** Confirm the preview and membership data are correct, then change `AUTOMATION_MODE` to `live` and redeploy. The first live run may create renewal invoices, expire recently lapsed members, and queue/send emails shown in the preview.

## The Renewals page

- Shows whether automation is Live or Dry run, and whether email is ready.
- Previews the next run, including members waiting for the expiry threshold and members with no paid-until date.
- Shows recent runs and every email with its status. Administrators can press "Send waiting emails now".
- A failed email is retried up to 3 times, an hour apart. Bad addresses are not retried.

## Good to know

- Emails are in English for now. Malay versions are easy to add.
- Vercel Cron is configured to call the daily job once each day at 9am Malaysia time (`0 1 * * *` UTC in `vercel.json`).
- Emails older than 14 days are never sent, because they would be out of date.
- Renewal and expiry timing is set in `src/modules/notifications/reminders.ts` (30-day lead and 365-day expiry delay). Automatic payment reminders are disabled.
