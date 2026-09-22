import { hasBankDetails, ORG } from "@/lib/org";
import type { ReminderStage } from "./reminders";

export type EmailKind =
  | "registration_received"
  | "invoice_issued"
  | "payment_reminder"
  | "membership_expired"
  | "payment_receipt";

export interface MailContext {
  memberName: string;
  membershipNo: string;
  invoiceNo?: string;
  amount?: string; // invoice total, e.g. "350.00"
  balance?: string; // still to pay
  dueDate?: string; // YYYY-MM-DD
  periodStart?: string;
  periodEnd?: string;
  expiryDate?: string;
  receiptNo?: string;
  paidOn?: string;
  paidAmount?: string;
  method?: string; // already in words, e.g. "Bank transfer"
  stage?: ReminderStage;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 2026-09-21 becomes 21/09/2026. */
export function fmtDate(iso: string | undefined): string {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : (iso ?? "");
}

export function fmtMoney(amount: string | undefined): string {
  const n = Number(amount);
  return Number.isFinite(n) ? `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
}

type Fact = [label: string, value: string];

function bankFacts(invoiceNo?: string): Fact[] {
  if (!hasBankDetails()) return [];
  return [
    ["Bank", ORG.bank.bankName],
    ["Account name", ORG.bank.accountName],
    ["Account number", ORG.bank.accountNumber],
    ["Reference", invoiceNo ? `${invoiceNo} (please use this)` : ORG.paymentNote],
  ].filter(([, v]) => v) as Fact[];
}

interface Layout {
  subject: string;
  paragraphs: string[];
  facts?: Fact[];
  bank?: boolean;
  invoiceNo?: string;
  closing?: string;
}

function render(layout: Layout): RenderedEmail {
  const facts = layout.facts ?? [];
  const bank = layout.bank ? bankFacts(layout.invoiceNo) : [];
  const contact = ORG.email ? `Questions? Reply to this email or write to ${ORG.email}.` : "Questions? Simply reply to this email.";
  const closing = layout.closing ?? "Thank you.";

  const text = [
    ...layout.paragraphs,
    ...(facts.length ? ["", ...facts.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(bank.length ? ["", "How to pay:", ...bank.map(([k, v]) => `${k}: ${v}`)] : []),
    "",
    contact,
    "",
    closing,
    ORG.name,
  ].join("\n");

  const factRows = (rows: Fact[]) =>
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 16px 4px 0;color:#555;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:4px 0;font-weight:bold;">${escapeHtml(v)}</td></tr>`
      )
      .join("");

  const html = `<!doctype html>
<html><body style="margin:0;background:#fbf5e6;font-family:Arial,Helvetica,sans-serif;color:#071b3d;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;">
  <div style="background:#0b2a5b;border-bottom:4px solid #d7263d;padding:16px 24px;color:#fbf5e6;font-size:18px;font-weight:bold;">${escapeHtml(ORG.name)}</div>
  <div style="padding:24px;font-size:15px;line-height:1.55;">
    ${layout.paragraphs.map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p)}</p>`).join("\n    ")}
    ${facts.length ? `<table style="border-collapse:collapse;margin:8px 0 16px;font-size:15px;">${factRows(facts)}</table>` : ""}
    ${bank.length ? `<div style="border:1px solid #e4d9c0;padding:12px 16px;margin:16px 0;"><p style="margin:0 0 6px;font-weight:bold;color:#0b2a5b;">How to pay</p><table style="border-collapse:collapse;font-size:15px;">${factRows(bank)}</table></div>` : ""}
    <p style="margin:16px 0 0;color:#555;font-size:14px;">${escapeHtml(contact)}</p>
    <p style="margin:16px 0 0;">${escapeHtml(closing)}<br>${escapeHtml(ORG.name)}</p>
  </div>
</div></body></html>`;

  return { subject: layout.subject, text, html };
}

export function renderEmail(kind: EmailKind, c: MailContext): RenderedEmail {
  const hello = `Dear ${c.memberName},`;

  switch (kind) {
    case "registration_received":
      return render({
        subject: `We received your DPMM membership application (${c.membershipNo})`,
        paragraphs: [
          hello,
          "Thank you for applying to join DPMM. We have received your application and the secretariat will review it.",
          "To complete your membership, please pay the invoice below. Once we confirm your payment, your membership becomes active.",
        ],
        facts: [
          ["Application number", c.membershipNo],
          ...(c.invoiceNo ? ([["Invoice", c.invoiceNo]] as Fact[]) : []),
          ...(c.amount ? ([["Amount", fmtMoney(c.amount)]] as Fact[]) : []),
          ...(c.dueDate ? ([["Please pay by", fmtDate(c.dueDate)]] as Fact[]) : []),
        ],
        bank: true,
        invoiceNo: c.invoiceNo,
      });

    case "invoice_issued":
      return render({
        subject: `Your DPMM membership renewal: invoice ${c.invoiceNo ?? ""}`.trim(),
        paragraphs: [
          hello,
          c.expiryDate
            ? `Your DPMM membership is paid until ${fmtDate(c.expiryDate)}. To keep it going without a break, please pay your renewal invoice before then.`
            : "Your DPMM membership is due for renewal. Please pay the invoice below to keep it going.",
        ],
        facts: [
          ["Membership number", c.membershipNo],
          ...(c.invoiceNo ? ([["Invoice", c.invoiceNo]] as Fact[]) : []),
          ...(c.periodStart && c.periodEnd ? ([["Renewal period", `${fmtDate(c.periodStart)} to ${fmtDate(c.periodEnd)}`]] as Fact[]) : []),
          ...(c.amount ? ([["Amount", fmtMoney(c.amount)]] as Fact[]) : []),
          ...(c.dueDate ? ([["Please pay by", fmtDate(c.dueDate)]] as Fact[]) : []),
        ],
        bank: true,
        invoiceNo: c.invoiceNo,
      });

    case "payment_reminder": {
      const stage = c.stage ?? "due_soon";
      const subject =
        stage === "due_soon"
          ? `Reminder: DPMM invoice ${c.invoiceNo} is due on ${fmtDate(c.dueDate)}`
          : stage === "overdue_1"
            ? `DPMM invoice ${c.invoiceNo} is overdue`
            : `Final reminder: DPMM invoice ${c.invoiceNo} is still unpaid`;
      const lead =
        stage === "due_soon"
          ? `This is a friendly reminder that your invoice is due on ${fmtDate(c.dueDate)}.`
          : stage === "overdue_1"
            ? `Our records show your invoice was due on ${fmtDate(c.dueDate)} and is still unpaid.`
            : `Your invoice, due on ${fmtDate(c.dueDate)}, is still unpaid. Please arrange payment as soon as you can.`;
      return render({
        subject,
        paragraphs: [hello, lead, "If you have already paid, thank you. Please reply with your payment reference so we can match it."],
        facts: [
          ["Membership number", c.membershipNo],
          ["Invoice", c.invoiceNo ?? ""],
          ["Amount to pay", fmtMoney(c.balance ?? c.amount)],
          ["Due date", fmtDate(c.dueDate)],
        ],
        bank: true,
        invoiceNo: c.invoiceNo,
      });
    }

    case "membership_expired":
      return render({
        subject: "Your DPMM membership has expired",
        paragraphs: [
          hello,
          `Your DPMM membership (${c.membershipNo}) expired on ${fmtDate(c.expiryDate)}.`,
          c.invoiceNo
            ? "You can renew it by paying the invoice below."
            : "To renew, please contact the secretariat and we will send you a renewal invoice.",
        ],
        facts: c.invoiceNo
          ? [
              ["Invoice", c.invoiceNo],
              ["Amount to pay", fmtMoney(c.balance ?? c.amount)],
            ]
          : [],
        bank: Boolean(c.invoiceNo),
        invoiceNo: c.invoiceNo,
      });

    case "payment_receipt":
      return render({
        subject: `Payment received: receipt ${c.receiptNo ?? ""}`.trim(),
        paragraphs: [
          hello,
          "Thank you. We have received your payment.",
          ...(c.expiryDate ? [`Your membership is now paid until ${fmtDate(c.expiryDate)}.`] : []),
        ],
        facts: [
          ["Receipt", c.receiptNo ?? ""],
          ["Invoice", c.invoiceNo ?? ""],
          ["Amount received", fmtMoney(c.paidAmount)],
          ["Date received", fmtDate(c.paidOn)],
          ...(c.method ? ([["Paid by", c.method]] as Fact[]) : []),
          ...(c.balance && Number(c.balance) > 0 ? ([["Balance still to pay", fmtMoney(c.balance)]] as Fact[]) : []),
        ].filter(([, v]) => v) as Fact[],
      });
  }
}
