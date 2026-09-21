# DPMM Membership System

Membership management for DPMM Putrajaya: online applications, member directory, invoices and payments,
automatic renewals and reminder emails. Built with Next.js (App Router), Tailwind, PostgreSQL on Neon, deployed on Vercel.

**Start with `docs/GO-LIVE.md`.** It is the checklist for launching.

## Set up on a computer

```bash
npx create-next-app@latest dpmm-members --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
cd dpmm-members
npm install drizzle-orm @neondatabase/serverless bcryptjs
npm install -D drizzle-kit dotenv tsx exceljs
```

Then copy the contents of this project **on top of** the new folder (overwrite when asked), and:

1. Open `tsconfig.json` and set `"exclude": ["node_modules", "scripts", "tests"]`.
2. Add these lines to `.gitignore` so member data never reaches GitHub:
   ```
   *.xlsx
   *.csv
   /data/
   ```
3. Copy `.env.example` to `.env.local` and fill it in. **Use the Neon `dev` branch for local work, never `main`.**
4. In `package.json`, add to `"scripts"`: `"test": "node tests/run-all.mjs"`.

```bash
npm run dev     # the site at http://localhost:3000
npm test        # runs all automated checks (about 200)
```

## What is where

| Folder | What it holds |
|---|---|
| `src/app/` | Pages and routes: public (`/`, `/register`, `/login`), staff (`/admin/...`), member portal placeholder (`/portal`), and the daily job (`/api/cron/renewals`) |
| `src/modules/` | The business logic, one folder per feature: `auth`, `members`, `registration`, `billing`, `notifications`, `dashboard`, `audit` |
| `src/lib/` | Small shared helpers: money, dates, phone and IC cleaning, masking, your organisation details (`org.ts`) |
| `src/db/` | Database connection and table definitions |
| `db/sql/` | The database migrations, in order (0000 to 0004). All are already applied to your Neon project |
| `scripts/import/` | The one-off Excel import used to load the original 248 members |
| `tests/` | Automated checks for the rules that matter (money, dates, security, validation, emails) |
| `docs/` | One short guide per build step, and the go-live checklist |

## Rules to keep when changing things

- **Check the role in every page and every function that returns member data**, not only in a layout.
- **Money and membership changes go through the database functions** (`record_payment`, `create_invoice`, ...), so they succeed or fail as one unit.
- **Never put member data, passwords or keys in the project.** Secrets live in environment variables only.
- **Run `npm test` before every deploy.**
