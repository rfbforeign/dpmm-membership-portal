# Step 1: Foundation setup

Goal: a deployed page on Vercel that reads the 6 membership types from your Neon database.

## 1. Create the Next.js app

```bash
npx create-next-app@latest dpmm-members --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
cd dpmm-members
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit dotenv
```

Accept the defaults for any other prompts. This starter assumes Tailwind v4, which is what `create-next-app` installs today.

## 2. Copy this bundle into the project

Unzip this bundle **on top of** the project folder, and let it overwrite `src/app/globals.css`, `src/app/layout.tsx` and `src/app/page.tsx`.

## 3. Protect member data

Your Excel file holds IC numbers, phone numbers and addresses of 248 people. Keep it out of Git:

```bash
printf '\n# Member data (personal data: never commit)\n*.xlsx\n*.csv\n/data/\n' >> .gitignore
```

`create-next-app` already ignores `.env*` files, so your database passwords stay out of Git too.

## 4. Connect to Neon

1. Open the Neon console, project **dpmm-members**, branch **dev**, and click **Connect**.
2. Copy the **pooled** connection string into `DATABASE_URL` and the **direct** one into `DATABASE_URL_UNPOOLED`.
3. Save them in `.env.local` (copy `.env.example` as a starting point).

## 5. Run it

```bash
npm run dev
```

Open http://localhost:3000. You should see the 6 membership types with their fees.
Open http://localhost:3000/api/health. You should see `{"status":"ok","database":"connected","membershipTypes":6}`.

## 6. Push to GitHub

Create a **private** repository on GitHub, then:

```bash
git add -A
git commit -m "Step 1: foundation"
git remote add origin https://github.com/YOUR-ORG/dpmm-members.git
git push -u origin main
```

## 7. Deploy on Vercel

1. Vercel dashboard: **Add New, Project**, import the GitHub repository.
2. Add environment variable `DATABASE_URL` (pooled string) for Production, Preview and Development.
3. Deploy, then open `/api/health` on the live URL.

> **Use the `dev` branch connection string for every Vercel environment for now.**
> The Neon `main` branch is intentionally empty. Switch Production to `main` once the schema has been applied there.

## Reference files

- `db/sql/0000_init.sql`: the full 12-table schema, already applied to the Neon `dev` branch.
- `src/db/schema.ts`: Drizzle definition for `membership_types` only. Step 2 adds the remaining tables.
- `drizzle.config.ts`: ready for Step 2; not needed to run the page.
