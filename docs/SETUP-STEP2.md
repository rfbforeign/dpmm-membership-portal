# Step 2: Import your members from Excel

This imports the 248 members from `DPMM_Membership_Tracker_6.xlsx` into your Neon **dev** branch,
cleaning the data on the way in. It is safe to run more than once: members already imported are skipped.

## 1. Add the files

Unzip this bundle **on top of** your project folder. It adds a `scripts/import/` folder.

## 2. Install two dev tools

```bash
npm install -D tsx exceljs
```

## 3. Stop the build from checking the scripts

Open `tsconfig.json` and add `"scripts"` to the `exclude` list:

```json
"exclude": ["node_modules", "scripts"]
```

Without this, `next build` would type-check these one-off scripts as part of the website.

## 4. Put the Excel file in a private folder

```bash
mkdir data
```

Copy `DPMM_Membership_Tracker_6.xlsx` into `data/`. The `.gitignore` line from Step 1 already keeps `*.xlsx` and `/data/` out of GitHub.
Confirm with `git status`: the file must **not** appear.

## 5. Dry run (changes nothing)

```bash
npx tsx scripts/import/import-members.ts --file ./data/DPMM_Membership_Tracker_6.xlsx
```

Expected result for your current file:

- Rows read 248, ready to import 248, skipped 0
- Status: active 169, expired 74, pending 5
- Type: 6.2.1 has 100, 6.2.5 has 148
- One new business type created (`EVENT MANAGEMENT, PRINTING/ADVERTISING`)

The report lists membership numbers only, never names, emails or IC numbers, so it is safe to paste into a chat.

## 6. Real import

Make sure `DATABASE_URL` in `.env.local` is the **dev** branch string, then:

```bash
npx tsx scripts/import/import-members.ts --file ./data/DPMM_Membership_Tracker_6.xlsx --apply
```

All 248 members go in as one transaction: everything succeeds or nothing is written.
Open `http://localhost:3000/api/health` afterwards. It still works as before.

## What the import does to your data

| In the spreadsheet | In the database |
|---|---|
| Phone `012-3456789`, `(012) 3456789` | `+60123456789` |
| Office Tel (same as phone in 245 of 248 rows) | Stored only when different |
| IC `800101015555` | `800101-01-5555` |
| IC `0` (7 rows) | Empty |
| Joined date stored as text, some with a time | A real date |
| 4 spellings of sectors, 2 of business types | One standard value each |
| Receipt No and Payment Notes text | Kept word for word in `legacy_data` |

## Needs a human decision (not changed automatically)

- 6 IC numbers in an unusual format are kept as written: PJ-2026-0020, 0053, 0055, 0109, 0114, 0159.
- 3 members have joined dates in the future: PJ-2026-0246, 0247, 0248.
- 2 members have placeholder-looking names: PJ-2026-0210, 0215.

## Not imported yet

Payment history. It exists only as free text in the spreadsheet (for example "FOR 3 YRS"), so the
import keeps that text safe but does not guess membership periods or invoices from it.
We will decide how to convert it once the renewal rule is confirmed.
