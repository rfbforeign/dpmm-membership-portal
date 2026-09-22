# DPMM Membership System

Membership management for DPMM Putrajaya: online applications, member directory, invoices and payments,
automatic renewals and reminder emails. Built with Next.js (App Router), Tailwind, PostgreSQL on Neon, deployed on Vercel.

**Start with `docs/GO-LIVE.md`.** It is the checklist for launching.

## Set up on a computer

This project is self-contained: `package.json` and the Next.js/TypeScript/Tailwind config are already
included, so there is no scaffolding step.

```bash
npm install
cp .env.example .env.local   # then fill it in — see below
npm run dev                  # the site at http://localhost:3000
npm test                     # runs all automated checks (about 200)
```

**`.env.local`**: use the Neon **`dev`** branch connection strings for local work — never `main`,
which is the live members' database.

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

## Putting this on GitHub

**Every file must sit at the top level of the repository** — `package.json`, `src/`, `db/` and so on
directly in the repo root, not inside a subfolder. If you use GitHub's web "Add files via upload"
button, select and drag in the *contents* of this folder, not the folder itself; dragging the folder
in creates an extra level of nesting that stops Vercel from finding `package.json`, and every page
then shows Vercel's "This page doesn't exist." Using `git push` from a normal clone avoids this
automatically, since it always pushes from the repository root.

## Rules to keep when changing things

- **Check the role in every page and every function that returns member data**, not only in a layout.
- **Money and membership changes go through the database functions** (`record_payment`, `create_invoice`, ...), so they succeed or fail as one unit.
- **Never put member data, passwords or keys in the project.** Secrets live in environment variables only.
- **Run `npm test` before every deploy.**
