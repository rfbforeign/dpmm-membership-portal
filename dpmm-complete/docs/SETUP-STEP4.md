# Step 4: Public registration

Anyone can now apply for membership online. Each application lands in your member list as **Pending**.

## What you get

| Address | What it does |
|---|---|
| `/register` | Public application form, with the fees for each membership type |
| `/register/thanks` | Confirmation showing the applicant's application number |
| `/admin/members?status=pending` | Staff see all pending applications (also linked from the dashboard) |

The home page now has an **Apply for membership** button.

## 1. Copy the files

Unzip this bundle **on top of** your project folder (after Step 3) and allow it to overwrite:
`src/db/schema.ts`, `src/app/page.tsx`, `src/app/admin/page.tsx` and
`src/app/admin/members/[id]/page.tsx`.

No new packages are needed.

## 2. Database change

`db/sql/0002_registration.sql` adds one column, `pdpa_consent_at`, to record when an applicant agreed to the data-protection notice.
It has **already been applied to both Neon branches** (`main` and `dev`).

## 3. Try it

```bash
npm run dev
```

1. Open http://localhost:3000/register (no sign-in needed).
2. Choose a type. The form shows what is due: for example, type 6.2.1 shows RM50 registration + RM50 first year = RM100.
3. Submit with a test person. You get an application number such as `PJ-2026-0249`.
4. Sign in as staff. The dashboard offers "Review 6 pending applications". Open it and check the profile.
   The admin notes say "Applied online", and the consent date is recorded.

**Use the `dev` database for testing.** Every application, even a test one, uses up a membership number.

## What the form checks

- Company and cooperative types must give the company name and SSM number. Every type needs an IC number and phone.
- Applying twice with the same email and name within 24 hours shows the first application again instead of creating a second one.
- A company whose SSM number is already a member is stopped with a message to contact the secretariat.
- If the IC number matches an existing member, the application is still accepted (one person can hold two companies) but the admin notes flag it for staff to check.
- Bots: a hidden field catches simple ones, and no more than 20 applications are accepted per hour.

## Before you open this to the public

- **Add a proper bot check.** A free service like Cloudflare Turnstile is the usual choice. Tell me and I will add it.
- **Have the consent wording reviewed.** The checkbox text is a plain-language draft, not legal advice.
- **Give the applicant payment details.** The confirmation page says the secretariat will contact them. Automatic invoices come in Step 5, and emailed confirmations in Step 7.
- **Existing members** were imported without a consent record. Ask them to confirm when the member portal opens.

## Numbering

New applicants continue from the last imported number, with the current year: `PJ-2026-0249`, `PJ-2026-0250` and so on.
On 1 January the middle part changes to the new year while the counter carries on. Tell me if you want it to restart each year instead.
