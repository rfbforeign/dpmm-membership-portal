import { classifyReminderStage, invoiceIssuedKey, reminderKey, expiredKey, registrationKey, receiptKey } from "@/modules/notifications/reminders";
import { renderEmail, escapeHtml, fmtDate, fmtMoney } from "@/modules/notifications/templates";
import { getEmailConfig, sendingAllowed, sendEmail } from "@/modules/notifications/resend";
import { isAuthorizedCron } from "@/lib/cron-auth";
let fail = 0;
async function main() {
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? "ok  " : "FAIL", n, ok ? "" : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const yes = (n: string, c: boolean) => eq(n, c, true);

// --- reminder schedule
eq("due in 4 days: nothing yet", classifyReminderStage(4), null);
eq("due in 3 days", classifyReminderStage(3), "due_soon");
eq("due today", classifyReminderStage(0), "due_soon");
eq("1 day overdue", classifyReminderStage(-1), "overdue_1");
eq("6 days overdue", classifyReminderStage(-6), "overdue_1");
eq("7 days overdue", classifyReminderStage(-7), "overdue_7");
eq("30 days overdue", classifyReminderStage(-30), "overdue_7");
eq("31 days overdue: left to a person", classifyReminderStage(-31), null);
eq("very old: never chased automatically", classifyReminderStage(-400), null);
eq("keys are stable and distinct", new Set([invoiceIssuedKey("a"), reminderKey("a", "due_soon"), reminderKey("a", "overdue_1"), reminderKey("a", "overdue_7"), expiredKey("m", "2026-01-01"), registrationKey("PJ-1"), receiptKey("RCP-1")]).size, 7);

// --- formatting + safety
eq("date", fmtDate("2026-09-21"), "21/09/2026");
eq("money", fmtMoney("1350"), "RM 1,350.00");
eq("money blank when missing", fmtMoney(undefined), "");
eq("html escaping", escapeHtml(`<script>alert("x")</script> & 'y'`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;");

// --- templates
const base = { memberName: "Aisyah <b>Omar</b>", membershipNo: "PJ-2026-0250", invoiceNo: "INV-2026-0012", amount: "350.00", balance: "250.00", dueDate: "2026-10-05" };
for (const [kind, ctx] of [["registration_received", base], ["invoice_issued", { ...base, expiryDate: "2026-10-04", periodStart: "2026-10-05", periodEnd: "2027-10-04" }],
  ["payment_reminder", { ...base, stage: "due_soon" }], ["payment_reminder", { ...base, stage: "overdue_1" }], ["payment_reminder", { ...base, stage: "overdue_7" }],
  ["membership_expired", { ...base, expiryDate: "2026-09-05" }], ["payment_receipt", { ...base, receiptNo: "RCP-2026-0007", paidAmount: "100.00", paidOn: "2026-09-21", method: "Bank transfer", expiryDate: "2027-10-04" }]] as const) {
  const e = renderEmail(kind, ctx as any);
  const label = `${kind}${(ctx as any).stage ? ":" + (ctx as any).stage : ""}`;
  yes(`${label}: has subject, text and html`, !!e.subject && e.text.length > 50 && e.html.startsWith("<!doctype html>"));
  yes(`${label}: member name is escaped in HTML`, !e.html.includes("<b>Omar</b>") && e.html.includes("&lt;b&gt;Omar&lt;/b&gt;"));
}
const reg = renderEmail("registration_received", base);
yes("registration mentions RHB account, invoice, due date and RM350", reg.text.includes("21601100010342") && reg.text.includes("INV-2026-0012") && reg.text.includes("05/10/2026") && reg.text.includes("RM 350.00"));
yes("registration uses invoice number as payment reference", reg.text.includes("INV-2026-0012 (please use this)"));
eq("subjects for the three reminder stages differ", new Set(["due_soon", "overdue_1", "overdue_7"].map(s => renderEmail("payment_reminder", { ...base, stage: s as any }).subject)).size, 3);
yes("overdue_7 subject says final reminder", renderEmail("payment_reminder", { ...base, stage: "overdue_7" }).subject.startsWith("Final reminder"));
const exp = renderEmail("membership_expired", { memberName: "A", membershipNo: "PJ-1", expiryDate: "2026-09-05" });
yes("expired without an invoice: no bank block, asks to contact us", !exp.text.includes("How to pay") && exp.text.includes("contact the secretariat"));
const rc = renderEmail("payment_receipt", { ...base, receiptNo: "RCP-1", paidAmount: "100.00", paidOn: "2026-09-21", balance: "250.00" });
yes("part-payment receipt shows the balance still owed", rc.text.includes("Balance still to pay: RM 250.00"));
const rcFull = renderEmail("payment_receipt", { ...base, receiptNo: "RCP-1", paidAmount: "350.00", paidOn: "2026-09-21", balance: "0.00", expiryDate: "2027-10-04" });
yes("full receipt states paid-until and no balance line", rcFull.text.includes("paid until 04/10/2027") && !rcFull.text.includes("Balance still to pay"));

// --- email settings
eq("no key -> not configured", getEmailConfig({}), null);
eq("key but no sender -> not configured", getEmailConfig({ RESEND_API_KEY: "k" }), null);
eq("configured", getEmailConfig({ RESEND_API_KEY: " k ", EMAIL_FROM: "DPMM <a@b.my>", EMAIL_REPLY_TO: "help@b.my" }), { apiKey: "k", from: "DPMM <a@b.my>", replyTo: "help@b.my" });
eq("sending blocked on a developer machine", sendingAllowed({ NODE_ENV: "development" }), false);
eq("sending blocked on a preview site", sendingAllowed({ VERCEL_ENV: "preview" }), false);
eq("sending allowed on the live site", sendingAllowed({ VERCEL_ENV: "production" }), true);
eq("explicit override allowed", sendingAllowed({ EMAIL_FORCE_SEND: "true" }), true);

// --- the call to the email service, against a stand-in for the network
const cfg = { apiKey: "re_test", from: "DPMM <a@b.my>", replyTo: "help@b.my" };
const msg = { to: "member@example.com", subject: "S", text: "T", html: "<p>H</p>", idempotencyKey: "notif-123" };
let seen: any;
const fake = (status: number, body: unknown) => (async (url: any, init: any) => { seen = { url, init }; return new Response(JSON.stringify(body), { status }); }) as typeof fetch;
const ok = await sendEmail(cfg, msg, fake(200, { id: "abc" }));
eq("success returns the message id", ok, { ok: true, id: "abc" });
eq("posts to the Resend endpoint", seen.url, "https://api.resend.com/emails");
eq("sends the key as a bearer token", seen.init.headers.Authorization, "Bearer re_test");
eq("sends an idempotency key", seen.init.headers["Idempotency-Key"], "notif-123");
const sent = JSON.parse(seen.init.body);
eq("body has from/to/subject/reply_to", [sent.from, sent.to, sent.subject, sent.reply_to], ["DPMM <a@b.my>", ["member@example.com"], "S", "help@b.my"]);
eq("rejected message: not retryable", await sendEmail(cfg, msg, fake(422, { message: "Invalid `from` field" })), { ok: false, error: "Invalid `from` field", retryable: false });
eq("bad key: not retryable", (await sendEmail(cfg, msg, fake(401, { message: "API key is invalid" }))).ok === false && (await sendEmail(cfg, msg, fake(401, {}))).retryable, false);
eq("rate limit: retryable", (await sendEmail(cfg, msg, fake(429, { message: "slow down" }))).retryable, true);
eq("server error: retryable", (await sendEmail(cfg, msg, fake(503, {}))).retryable, true);
const boom = await sendEmail(cfg, msg, (async () => { throw new TypeError("fetch failed"); }) as any);
eq("network failure: retryable, no crash", [boom.ok, (boom as any).retryable], [false, true]);
const bad = await sendEmail(cfg, { ...msg, to: "not-an-email" }, fake(200, { id: "x" }));
eq("bad address refused without calling the service", [bad.ok, (bad as any).retryable], [false, false]);

// --- cron security
eq("correct secret accepted", isAuthorizedCron("Bearer s3cret", "s3cret"), true);
eq("wrong secret refused", isAuthorizedCron("Bearer nope", "s3cret"), false);
eq("no header refused", isAuthorizedCron(null, "s3cret"), false);
eq("no secret configured refuses everything", isAuthorizedCron("Bearer ", ""), false);
eq("secret without 'Bearer' refused", isAuthorizedCron("s3cret", "s3cret"), false);

  console.log(fail ? `\n${fail} FAILED` : "\nall checks passed"); process.exit(fail ? 1 : 0);
}
main();
