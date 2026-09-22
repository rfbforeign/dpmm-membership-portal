# Step 3: Member directory and editing

Adds a searchable list of all 248 members, a profile page for each, and an edit form.

## What you get

| Address | What it does | Who |
|---|---|---|
| `/admin/members` | Search, filter by status and type, 25 per page | All staff |
| `/admin/members/<id>` | Full profile, including payment records from the old spreadsheet | All staff |
| `/admin/members/<id>/edit` | Edit a member | Admin and Secretariat only |

## 1. Copy the files

Unzip this bundle **on top of** your project folder (after Step 2b) and allow it to overwrite:
`src/db/schema.ts`, `src/modules/auth/types.ts`, `src/modules/auth/actions.ts`,
`src/app/login/login-form.tsx` and `src/app/admin/layout.tsx`.

No new packages and no database changes are needed.

## 2. Try it

```bash
npm run dev
```

Sign in, then open **Members** in the top bar.

- Search for part of a name, company, membership number, email or phone.
- Filter by status (for example Expired: 74) or by membership type (6.2.1: 100).
- Open a member, then **Edit member**, change a phone number, and save.
  The profile shows "Changes saved", and the change is recorded in the audit log.

## Who sees what

| | Admin | Secretariat | Treasurer |
|---|---|---|---|
| View members | Yes | Yes | Yes |
| Full IC number | Yes | Yes | Masked (******-**-5555) |
| Edit members | Yes | Yes | No |

## Fixing the records flagged during the import

Use **Edit member** on each:

- **Future joined dates** (PJ-2026-0246, 0247, 0248): enter the correct date. New future dates are refused.
- **Placeholder names** (PJ-2026-0210, 0215): enter the real name and status.
- **Unusual IC formats** (PJ-2026-0020, 0053, 0055, 0109, 0114, 0159): correct to `000000-00-0000`.
  You can save other changes without touching an old odd IC, but a new IC must be in the right format.
  PJ-2026-0020 lists two people's IC numbers in one field; keep the main member's and note the other in Internal notes.
- **SSM number damaged by Excel** (PJ-2026-0099): enter the real number.
- **Registered address holding dates** (PJ-2026-0052): enter the real address.

## Good to know

- Phone numbers are saved as +60 numbers whatever you type (012-3456789 becomes +60123456789).
- Every edit is written to the audit log with what changed. IC numbers are logged only as "changed".
- If two people edit the same member at the same moment, the last save wins.
- Adding new members comes with the public registration form in Step 4.
