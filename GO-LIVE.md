# Go-live checklist

Everything between "the code is built" and "members are using it". **Who** shows whether a step is yours or mine.

## 1. Where things stand

| Area | State |
|---|---|
| Applications, member directory and editing, invoices, payments, receipts, renewals, reminders, dashboard | Built and tested |
| Production database (Neon `main`) | Ready: all tables, all 248 members, 34 paid-until dates. No invoices, payments or emails yet |
| Code on GitHub | You said it is uploaded. Replace it with the complete project in this bundle (see step 4) |
| Vercel | Not connected to me, so I cannot check it. You do the steps in section 6 |
| Online payment (FPX, cards) | Not built, by your choice. Bank transfer only for now |

## 2. Three things blocking launch

| # | What | Who |
|---|---|---|
| 1 | **A password for the live admin account.** It is deliberately disabled, so nobody can sign in. Send me a password of 12 or more characters and I will set it. Or ask me to generate a strong one and show it once | You, then me |
| 2 | **Vercel.** Either do section 6 yourself, or reconnect the Vercel connector in Claude settings and choose the `rfbforeign` team, so I can set the environment variables and check the first deployment | You |
| 3 | **The paid-until workbook** (`DPMM_PaidUntil_Review.xlsx`). It does not stop you launching applications, invoices and payments, but the automatic renewals need it. Give it to the treasurer and send it back filled in | You, then me |

## 3. Staff accounts

Only one account exists (the administrator). Tell me the **name, email and role** of each person:

| Role | Can do |
|---|---|
| Administrator | Everything, including recording payments and sending emails |
| Treasurer | View everything, create invoices, **record payments**, cancel invoices. Sees IC numbers masked |
| Secretariat | View everything, edit members, create invoices. Cannot record payments |

I will create each account with a temporary password and give it to that person. The system does not force a change yet, so ask everyone to change it straight away (Account, Change password).
There is no screen for managing staff yet, so ask me to add or deactivate people.

## 4. Put the code on GitHub  (You)

1. Make sure the repository is **Private**.
2. Copy the complete project over your existing one, following `README.md`.
3. Before committing, run these and check the output:
   ```bash
   git status
   git ls-files | grep -iE "\.(xlsx|csv)$|\.env"
   ```
   The second command must print **nothing** except `.env.example`. If it lists the Excel file or `.env.local`, stop and tell me.
4. `npm test` must say **All 6 test files passed**.
5. Commit and push.

## 5. Neon: the database  (mostly done)

| Branch | What it is |
|---|---|
| `main` | **Production.** Real members. Used by the live website only |
| `dev` | A copy for testing. Local work and preview sites use this |
| `main-empty-original` | An empty leftover. You may delete it |

- Each branch has two connection strings: **pooled** (host contains `-pooler`) and **direct**. The website uses pooled. Tools use direct.
- Your `.env.local` must use the **`dev`** strings. If you ever copied the old `dev` string before the branches were swapped, it now points at production. Re-copy from the Neon console to be safe.
- **Backups.** The free plan keeps very little history. Check Neon's current limits. Either upgrade the plan or ask me for a copy of the data each month, and keep it somewhere private.

## 6. Vercel: the website  (You)

1. Vercel: **Add New, Project**, import the GitHub repository.
2. Add environment variables. Tick **Production** for the first four; tick **Preview** and **Development** for `DATABASE_URL` too, using the `dev` string there:

| Name | Value | Production | Preview |
|---|---|---|---|
| `DATABASE_URL` | Pooled string from Neon **`main`** | Yes | Use **`dev`** string |
| `CRON_SECRET` | A long random string you make up | Yes | No |
| `AUTOMATION_MODE` | `dry_run` | Yes | No |
| `RESEND_API_KEY`, `EMAIL_FROM` | Add later, in section 7 | Later | No |

3. Deploy. The region is set to Singapore by `vercel.json`.
4. **Check the live site.** Every line should behave like this:

| Open | Expect |
|---|---|
| `/api/health` | `{"status":"ok","database":"connected","membershipTypes":6}` |
| `/register` | The application form, with fees for each type |
| `/login`, then `/admin` | After I set your password: the dashboard shows 248 members, 169 active, 74 expired, 5 pending |
| `/admin/notifications` | Says **Dry run** and previews about 10 renewal invoices |
| `/api/cron/renewals` in a browser | An **Unauthorized** message. That is correct: it is locked |

5. Optional: add your own domain (Vercel, Settings, Domains).
6. **Read Vercel's terms.** The free Hobby plan is for personal, non-commercial use. A system that collects membership fees may need a paid plan.

## 7. Email  (You, then I help test)

1. Create an account at resend.com.
2. Add your sending domain and add the DNS records it shows (they make your emails trusted, not spam). Wait until it says Verified.
3. Create an API key. In Vercel add `RESEND_API_KEY` and `EMAIL_FROM`, for example `DPMM Putrajaya <noreply@yourdomain.my>`. Redeploy.
4. **Test:** apply as a new member at `/register` with your own email. The confirmation email should arrive within a minute. Tell me, and I will remove the test record.
5. Emails are sent **only from the live site**, never from a computer or a preview site.

## 8. Get the data ready  (You and your treasurer)

- [ ] Fill in the paid-until workbook; send it back; I load it.
- [ ] Decide the 16 members marked Active whose last recorded payment period has ended.
- [ ] Fix the flagged records using **Edit member**: 6 unusual IC numbers, 3 future joined dates, 2 placeholder names, the damaged SSM number (PJ-2026-0099) and the address holding dates (PJ-2026-0052).
- [ ] Fill in your address, email and phone in `src/lib/org.ts` (the invoices leave them out until you do).
- [ ] The 5 pending applications and the "(TO REFUND)" member (PJ-2026-0215) need a decision.

## 9. Security and privacy

**Already in the system:** passwords stored as hashes; accounts lock after 5 wrong attempts; sign-in sessions stored in the database and ended by sign-out or password change; every page checks the role; IC numbers masked for the treasurer; every change written to an audit log; a bot trap and rate limit on the application form; the daily job locked by a secret; emails sent only from the live site; no member data, passwords or keys in the code.

**Needs you before launch:**
- [ ] **Turn on two-step verification** on your GitHub, Vercel, Neon and Resend accounts, and on the email account used to sign up to them. If any one is taken over, so is the system.
- [ ] Use a **long passphrase** for every staff account. The system does not have two-step sign-in of its own yet.
- [ ] **Have the consent wording reviewed** (the tick box on the application form) and publish a short **privacy notice** on your site: what you collect, why, who sees it, how long you keep it, how to ask for correction. This is a draft, not legal advice.
- [ ] Existing members were imported without a consent record. Plan to ask them to confirm.
- [ ] Decide who may be staff, and remove them when they leave (ask me to deactivate the account).
- [ ] Add a **bot check** (a free service such as Cloudflare Turnstile) to the application form. I can add it.

## 10. The launch order

| Step | What | Who |
|---|---|---|
| 1 | Set the live admin password | Me |
| 2 | Push the complete project to GitHub | You |
| 3 | Create the Vercel project and variables; deploy | You |
| 4 | Run the checks in section 6; tell me the results | You |
| 5 | Create staff accounts | Me |
| 6 | Two-step verification on all accounts; privacy notice | You |
| 7 | Load the paid-until workbook | You, then me |
| 8 | Set up email and send the test application | You |
| 9 | Set `AUTOMATION_MODE` to `live` and redeploy. The first run creates the renewal invoices and emails those members | You |
| 10 | Announce it. Watch the **Renewals** page and the dashboard for the first week | You |

## 11. If something goes wrong

- **Stop the automation:** set `AUTOMATION_MODE` back to `dry_run` and redeploy. Nothing further changes or sends.
- **A bad deployment:** in Vercel, open Deployments and promote the previous one. Takes seconds.
- **A wrong payment:** there is no reversal screen yet. Tell me the invoice number and I will correct it safely.
- **A wrong email went out:** the Renewals page shows every email sent. Tell me and I will check what was queued.
- **Data problem:** Neon can restore an earlier moment, within the limits of your plan. Act quickly and tell me.

## 12. Not built yet

Be aware of these when you plan your rollout.

| Missing | Effect |
|---|---|
| **Member sign-in and self-service** | Members cannot log in yet. They cannot see or update their own details or invoices online. Staff do it |
| Staff management screen | I add and remove staff for you |
| Payment reversal and refunds | Mistakes and refunds are corrected by me |
| Online payment (FPX, cards) | Your choice for later. Bank transfer only |
| Two-step sign-in for staff | Use strong passphrases |
| Exports (CSV or Excel of members, payments, invoices) | Ask me for a report when your accountant needs one |
| Malay language | Everything is in English |
| Bot check on the form | See section 9 |

The one to prioritise is **member sign-in**. It also lets you collect data-protection consent from your existing 248 members.
