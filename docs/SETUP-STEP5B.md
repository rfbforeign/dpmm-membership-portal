# Step 5b: Membership periods on the member profile

Each member's profile now has a **Membership periods** section listing every paid period and where it came from
(a paid invoice, the old spreadsheet, or added by staff). "Paid until" shows "(ended)" when the date is in the past.

## Copy the files

Unzip this bundle **on top of** your project folder (after Step 5) and allow it to overwrite:
`src/modules/billing/queries.ts` and `src/app/admin/members/[id]/page.tsx`.

No new packages and no database changes.

## What was loaded into the database

34 members had a clear date range in the old spreadsheet notes (for example `23/4/25-22/4/26`).
They were added as membership periods and their "Paid until" dates set, on both Neon branches.
Nobody's status was changed.

Not loaded, because the notes do not give an exact last day: year ranges such as `(2021-2029)`, and notes such as "FOR 3 YRS".
The review workbook `DPMM_PaidUntil_Review.xlsx` lists those members for the treasurer to complete.
