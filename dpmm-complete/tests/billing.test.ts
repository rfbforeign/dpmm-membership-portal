import { addDays, periodEnd, suggestPeriod } from "@/lib/dates";
import { parseMoneyToCents, centsToDecimal, validateInvoiceForm, validatePaymentForm, billingErrorMessage } from "@/modules/billing/validation";
import { canHandlePayments } from "@/modules/billing/permissions";
let fail = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? "ok  " : "FAIL", n, ok ? "" : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };

// dates
eq("+1 day month end", addDays("2026-01-31", 1), "2026-02-01");
eq("+1 day year end", addDays("2026-12-31", 1), "2027-01-01");
eq("period end: 1 year", periodEnd("2026-09-21"), "2027-09-20");
eq("period end: 3 years", periodEnd("2026-09-21", 3), "2029-09-20");
eq("period end: 1 Jan", periodEnd("2026-01-01"), "2026-12-31");
eq("period end: leap day start", periodEnd("2028-02-29"), "2029-02-28");
eq("period end: day before leap day", periodEnd("2027-02-28"), "2028-02-27");
eq("suggest: still current continues next day", suggestPeriod("2026-12-31", "2026-09-21"), { start: "2027-01-01", end: "2027-12-31" });
eq("suggest: expires today -> tomorrow", suggestPeriod("2026-09-21", "2026-09-21"), { start: "2026-09-22", end: "2027-09-21" });
eq("suggest: lapsed starts today", suggestPeriod("2026-01-01", "2026-09-21"), { start: "2026-09-21", end: "2027-09-20" });
eq("suggest: no expiry starts today", suggestPeriod(null, "2026-09-21"), { start: "2026-09-21", end: "2027-09-20" });

// money
eq("150", parseMoneyToCents("150"), 15000);
eq("150.5", parseMoneyToCents("150.5"), 15050);
eq("1,500.00", parseMoneyToCents("1,500.00"), 150000);
eq("RM 350", parseMoneyToCents("RM 350"), 35000);
eq("0.10 is exactly 10 cents", parseMoneyToCents("0.10"), 10);
eq("19.99 * 3 exact in cents", parseMoneyToCents("19.99")! * 3, 5997);
eq("three decimals rejected", parseMoneyToCents("1.234"), null);
eq("negative rejected", parseMoneyToCents("-5"), null);
eq("letters rejected", parseMoneyToCents("abc"), null);
eq("over RM1m rejected", parseMoneyToCents("1000000.01"), null);
eq("cents back to decimal", centsToDecimal(35000), "350.00");

// invoice form
const base = { invoiceType: "renewal", description: "Renewal 2027", dueDate: "2026-10-05", periodStart: "2027-01-01", periodEnd: "2027-12-31",
  item1Description: "Annual membership fee", item1Quantity: "1", item1Amount: "150", item2Description: "", item2Quantity: "", item2Amount: "" };
const ok = validateInvoiceForm(base, { today: "2026-09-21" });
eq("valid renewal", ok.ok, true);
if (ok.ok) eq("totals + cleaned items", [ok.data.totalCents, ok.data.items], [15000, [{ description: "Annual membership fee", quantity: 1, unitAmount: "150.00" }]]);
const multi = validateInvoiceForm({ ...base, invoiceType: "registration", periodStart: "", periodEnd: "", item1Description: "Registration fee", item1Amount: "200", item2Description: "Annual fee", item2Quantity: "3", item2Amount: "50.50" }, { today: "2026-09-21" });
eq("quantity x price total", multi.ok && multi.data.totalCents, 20000 + 3 * 5050);
eq("registration needs no period", multi.ok, true);
eq("renewal requires a period", (validateInvoiceForm({ ...base, periodStart: "", periodEnd: "" }, { today: "2026-09-21" }) as any).fieldErrors.periodStart !== undefined, true);
eq("past due date rejected", (validateInvoiceForm({ ...base, dueDate: "2026-09-20" }, { today: "2026-09-21" }) as any).fieldErrors.dueDate !== undefined, true);
eq("due today accepted", validateInvoiceForm({ ...base, dueDate: "2026-09-21" }, { today: "2026-09-21" }).ok, true);
eq("end before start rejected", (validateInvoiceForm({ ...base, periodEnd: "2026-12-31" }, { today: "2026-09-21" }) as any).fieldErrors.periodEnd !== undefined, true);
eq("no lines rejected", (validateInvoiceForm({ ...base, item1Description: "", item1Amount: "" }, { today: "2026-09-21" }) as any).fieldErrors.items, "Add at least one line.");
eq("amount without description flagged", (validateInvoiceForm({ ...base, item2Amount: "10" }, { today: "2026-09-21" }) as any).fieldErrors.item2Description !== undefined, true);
eq("description without amount flagged", (validateInvoiceForm({ ...base, item2Description: "Extra" }, { today: "2026-09-21" }) as any).fieldErrors.item2Amount !== undefined, true);
eq("zero total rejected", (validateInvoiceForm({ ...base, item1Amount: "0" }, { today: "2026-09-21" }) as any).fieldErrors.items, "The invoice total must be more than zero.");
eq("bad quantity flagged", (validateInvoiceForm({ ...base, item1Quantity: "0" }, { today: "2026-09-21" }) as any).fieldErrors.item1Quantity !== undefined, true);
eq("unknown type rejected", (validateInvoiceForm({ ...base, invoiceType: "gift" }, { today: "2026-09-21" }) as any).fieldErrors.invoiceType !== undefined, true);

// payment form
const pctx = { today: "2026-09-21", balanceCents: 35000, grantsMembership: true, invoicePeriod: { start: null, end: null } };
const pay = { amount: "350", method: "bank_transfer", paidOn: "2026-09-20", reference: " MBB 123 ", periodStart: "2026-09-21", periodEnd: "2027-09-20" };
const p1 = validatePaymentForm(pay, pctx);
eq("full payment valid", p1.ok, true);
if (p1.ok) eq("cleaned", [p1.data.amount, p1.data.reference, p1.data.periodStart, p1.data.periodEnd], ["350.00", "MBB 123", "2026-09-21", "2027-09-20"]);
eq("part payment ignores period", (validatePaymentForm({ ...pay, amount: "100", periodStart: "", periodEnd: "" }, pctx) as any).data.periodStart, null);
eq("full payment needs a period", (validatePaymentForm({ ...pay, periodStart: "", periodEnd: "" }, pctx) as any).fieldErrors.periodStart !== undefined, true);
eq("falls back to the invoice's own period", (validatePaymentForm({ ...pay, periodStart: "", periodEnd: "" }, { ...pctx, invoicePeriod: { start: "2027-01-01", end: "2027-12-31" } }) as any).data.periodEnd, "2027-12-31");
eq("overpay rejected", (validatePaymentForm({ ...pay, amount: "350.01" }, pctx) as any).fieldErrors.amount.includes("more than the balance"), true);
eq("future date rejected", (validatePaymentForm({ ...pay, paidOn: "2026-09-22" }, pctx) as any).fieldErrors.paidOn !== undefined, true);
eq("bad method rejected", (validatePaymentForm({ ...pay, method: "bitcoin" }, pctx) as any).fieldErrors.method !== undefined, true);
eq("zero amount rejected", (validatePaymentForm({ ...pay, amount: "0" }, pctx) as any).fieldErrors.amount !== undefined, true);
eq("'other' invoices need no period", (validatePaymentForm({ ...pay, periodStart: "", periodEnd: "" }, { ...pctx, grantsMembership: false }) as any).ok, true);

// errors + permissions
eq("db error mapped", billingErrorMessage(new Error("DPMM:period_overlaps")).startsWith("That membership period overlaps"), true);
eq("db error inside longer text", billingErrorMessage(new Error("NeonDbError: DPMM:amount_invalid at line 4")), "The amount is not valid for this invoice.");
eq("unknown error is generic", billingErrorMessage(new Error("connection reset")).startsWith("Sorry, something went wrong"), true);
eq("treasurer handles payments", canHandlePayments("treasurer"), true);
eq("secretariat cannot", canHandlePayments("secretariat"), false);
console.log(fail ? `\n${fail} FAILED` : "\nall checks passed"); process.exit(fail ? 1 : 0);
