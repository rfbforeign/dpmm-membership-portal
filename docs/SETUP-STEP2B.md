# Step 2b: Sign-in and roles

Adds a sign-in page, an admin area only staff can open, and a page to change your password.

## What you get

| Address | Who can open it |
|---|---|
| `/` | Anyone (fees table, with a "Sign in" button) |
| `/login` | Anyone |
| `/admin` | Admin, Secretariat, Treasurer: live member and billing figures |
| `/admin/account` | Same staff roles: change your password |
| `/portal` | Any signed-in user (placeholder for the member portal) |

## 1. Install one package

```bash
npm install bcryptjs
```

## 2. Copy the files

Unzip this bundle **on top of** your project folder and allow it to overwrite:
`src/db/schema.ts`, `src/db/index.ts` and `src/app/page.tsx`.

## 3. Database changes

`db/sql/0001_auth.sql` adds the sessions table and account-lockout columns.
It has **already been applied to the Neon `dev` branch**. Run it on `main` only when you go live.

## 4. Try it

```bash
npm run dev
```

1. Open http://localhost:3000 and click **Sign in**.
2. Sign in with the administrator email and the temporary password you were given (never write passwords in project files).
3. You land on the dashboard: 248 members, 169 active, 74 expired, 5 pending.
4. **Change your password straight away**: Account, then Change password (12 characters or more).
5. Try signing out, then opening http://localhost:3000/admin. You should be sent to the sign-in page.

## How it protects the system

- Passwords are stored as bcrypt hashes, never as text.
- The sign-in cookie is HttpOnly (page scripts cannot read it) and HTTPS-only on the live site.
- Sessions live in the database and last 12 hours. Signing out, deactivating a user, or changing a
  password ends sessions immediately.
- After 5 wrong passwords an account is locked for 15 minutes. The message is the same for wrong
  email, wrong password and locked account, so nobody can tell which emails have accounts.
- Every sign-in, failed attempt, lockout and password change is written to `audit_logs`.
- Each admin page and data function checks the role itself. Do the same in every new page.

## Adding people

Staff accounts are rows in the `users` table with a role (`admin`, `secretariat`, `treasurer`).
A screen to add and manage staff comes in a later step. Until then, ask me and I will create the
account for you.
