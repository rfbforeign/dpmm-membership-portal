# Step 5: Invoices and payments

Invoices, payment recording, and printable invoices and receipts. Recording a payment also extends the
member's paid-until date and activates them, in one safe step.

## What you get

| Address | What it does | Who |
|---|---|---|
| `/admin/invoices` | Search and filter all invoices (unpaid, overdue, paid, cancelled) | All staff |
| `/admin/invoices/new?member=...` | Create an invoice (registration, renewal or other) | All staff |
| `/admin/invoices/<id>` | Invoice detail, payments, and the "Record a payment" form | All staff view; Admin and Treasurer record payments and cancel |
| `/admin/invoices/<id>/print` | Print or save as PDF: invoice, and receipt once paid | All staff |

Also new:
- Each **member profile** lists its invoices with a "Create invoice" link.
- **New applications get an invoice automatically**: RM100 for an individual (Fasal 6.2.1), RM350 for a company (6.2.5).
  The confirmation page shows the invoice number and amount.

## 1. Copy the files

Unzip this bundle **on top of** your project folder (after Step 4) and allow it to overwrite:
`src/app/admin/layout.tsx`, `src/app/admin/members/[id]/page.tsx`, `src/app/register/thanks/page.tsx`
and `src/modules/registration/actions.ts`.

No new packages are needed.

## 2. Fill in your details

Open `src/lib/org.ts` and fill in your address, email, phone and **bank account**. They appear on printed invoices
and on the application confirmation page. Anything left empty is simply left out.

## 3. Database changes

`db/sql/0003_billing.sql` adds the billing rules as database functions, an invoice summary view, and two number sequences.
It has **already been applied to both Neon branches** (`main` and `dev`).

## 4. Try it (on the dev database)

```bash
npm run dev
```

1. Open a member, then **Create invoice**. The renewal form is pre-filled with the annual fee and the next membership year.
2. Save. On the invoice page, use **Record a payment** (Admin or Treasurer). Try a part payment first: the invoice stays unpaid with the balance shown.
3. Pay the rest. The invoice becomes **Paid**, the member becomes **Active**, and their profile shows **Paid until** the end date.
4. Click **Print invoice and receipt**, then use your browser's print dialog and choose "Save as PDF".
5. Apply as a new member at `/register`, then find the pending member and their invoice.

## Rules built in

- A payment cannot exceed the balance, cannot be dated in the future, and cannot be added to a paid or cancelled invoice.
- Membership dates cannot overlap an existing period for the same member. A renewal continues the day after the current period ends.
- A payment covering a period that has already ended leaves the member **Expired**, not Active.
- Suspended members stay suspended when they pay; a person decides when to reinstate them.
- Invoices of type "Other" (dinners, events) never change membership.
- If any step of recording a payment fails, nothing is saved.
- Only invoices with no payments can be cancelled.
- Amounts are handled in whole sen internally, so there are no rounding errors.

## Good to know

- **No reversal yet.** A payment recorded by mistake cannot be undone from the screen. Ask me and I will correct it safely in the database. A reversal screen is planned.
- **Your 248 existing members have no "paid until" date.** The old spreadsheet only has free text such as `23/4/25-22/4/26`.
  Until those are converted, renewal invoices start from today. The next step is a reviewed import of the dates that can be read reliably.
- **Payments are recorded by hand for now** (bank transfer, cash). Online payment (FPX and cards) comes in Step 6.
- **Renewal reminders and automatic renewal invoices** come in Step 7.
