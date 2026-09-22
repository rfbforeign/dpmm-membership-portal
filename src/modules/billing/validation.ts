import { clean, isValidIsoDate } from "@/lib/normalize";

export const INVOICE_TYPES = ["registration", "renewal", "other"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const PAYMENT_METHODS = ["bank_transfer", "cash", "fpx", "credit_card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  fpx: "FPX online banking",
  credit_card: "Credit or debit card",
  other: "Other (cheque, etc.)",
};

export const TYPE_LABEL: Record<InvoiceType, string> = {
  registration: "Registration",
  renewal: "Renewal",
  other: "Other",
};

export const MAX_ITEM_ROWS = 6;
const MAX_CENTS = 100_000_000; // RM 1,000,000

/** "1,500.50" or "RM150" to whole cents. Null when it is not a valid amount. */
export function parseMoneyToCents(text: string): number | null {
  const t = text.trim().replace(/^RM\s*/i, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, fraction = ""] = t.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents <= MAX_CENTS ? cents : null;
}

export const centsToDecimal = (cents: number): string => (cents / 100).toFixed(2);

// ---------------------------------------------------------------------------
// Invoice form
// ---------------------------------------------------------------------------

export interface InvoiceData {
  invoiceType: InvoiceType;
  description: string | null;
  dueDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  items: { description: string; quantity: number; unitAmount: string }[];
  totalCents: number;
}

export type InvoiceResult =
  | { ok: true; data: InvoiceData }
  | { ok: false; fieldErrors: Record<string, string> };

export function validateInvoiceForm(raw: Record<string, string>, ctx: { today: string }): InvoiceResult {
  const errors: Record<string, string> = {};

  const invoiceType = clean(raw.invoiceType) as InvoiceType | null;
  if (!invoiceType || !INVOICE_TYPES.includes(invoiceType)) errors.invoiceType = "Choose the type of invoice.";

  const description = clean(raw.description);
  if (description && description.length > 200) errors.description = "Keep this under 200 characters.";

  const dueDate = clean(raw.dueDate) ?? "";
  if (!isValidIsoDate(dueDate)) errors.dueDate = "Enter a valid due date.";
  else if (dueDate < ctx.today) errors.dueDate = "The due date cannot be in the past.";

  const periodStart = clean(raw.periodStart);
  const periodEnd = clean(raw.periodEnd);
  if (periodStart || periodEnd) {
    if (!periodStart || !isValidIsoDate(periodStart)) errors.periodStart = "Enter a valid start date.";
    if (!periodEnd || !isValidIsoDate(periodEnd)) errors.periodEnd = "Enter a valid end date.";
    if (!errors.periodStart && !errors.periodEnd && periodEnd! < periodStart!) {
      errors.periodEnd = "The end date must be after the start date.";
    }
  } else if (invoiceType === "renewal") {
    errors.periodStart = "Choose the period this renewal covers.";
  }

  const items: InvoiceData["items"] = [];
  let totalCents = 0;
  for (let n = 1; n <= MAX_ITEM_ROWS; n++) {
    const itemDescription = clean(raw[`item${n}Description`]);
    const quantityText = clean(raw[`item${n}Quantity`]);
    const amountText = clean(raw[`item${n}Amount`]);
    if (!itemDescription && !amountText) continue; // an empty row

    if (!itemDescription) errors[`item${n}Description`] = "Describe this line.";
    else if (itemDescription.length > 200) errors[`item${n}Description`] = "Keep this under 200 characters.";

    const quantity = quantityText ? Number(quantityText) : 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) errors[`item${n}Quantity`] = "Whole number, 1 or more.";

    const cents = amountText ? parseMoneyToCents(amountText) : null;
    if (cents === null) errors[`item${n}Amount`] = "Enter an amount like 150 or 150.00.";

    if (itemDescription && cents !== null && Number.isInteger(quantity) && quantity >= 1 && quantity <= 999) {
      items.push({ description: itemDescription, quantity, unitAmount: centsToDecimal(cents) });
      totalCents += cents * quantity;
    }
  }
  if (items.length === 0 && !Object.keys(errors).some((k) => k.startsWith("item"))) {
    errors.items = "Add at least one line.";
  } else if (items.length > 0 && totalCents <= 0) {
    errors.items = "The invoice total must be more than zero.";
  }

  if (Object.keys(errors).length > 0 || !invoiceType) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    data: { invoiceType, description, dueDate, periodStart, periodEnd, items, totalCents },
  };
}

// ---------------------------------------------------------------------------
// Payment form
// ---------------------------------------------------------------------------

export interface PaymentData {
  amount: string;
  amountCents: number;
  method: PaymentMethod;
  paidOn: string;
  reference: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export type PaymentResult =
  | { ok: true; data: PaymentData }
  | { ok: false; fieldErrors: Record<string, string> };

export function validatePaymentForm(
  raw: Record<string, string>,
  ctx: {
    today: string;
    balanceCents: number;
    /** True for registration and renewal invoices, which extend membership when fully paid. */
    grantsMembership: boolean;
    invoicePeriod: { start: string | null; end: string | null };
  }
): PaymentResult {
  const errors: Record<string, string> = {};

  const amountCents = parseMoneyToCents(clean(raw.amount) ?? "");
  if (amountCents === null || amountCents <= 0) errors.amount = "Enter the amount received, like 350.00.";
  else if (amountCents > ctx.balanceCents) errors.amount = `That is more than the balance of RM ${centsToDecimal(ctx.balanceCents)}.`;

  const method = clean(raw.method) as PaymentMethod | null;
  if (!method || !PAYMENT_METHODS.includes(method)) errors.method = "Choose how it was paid.";

  const paidOn = clean(raw.paidOn) ?? "";
  if (!isValidIsoDate(paidOn)) errors.paidOn = "Enter the date the payment was received.";
  else if (paidOn > ctx.today) errors.paidOn = "The payment date cannot be in the future.";

  const reference = clean(raw.reference);
  if (reference && reference.length > 100) errors.reference = "Keep this under 100 characters.";

  let periodStart = clean(raw.periodStart);
  let periodEnd = clean(raw.periodEnd);
  const completes = amountCents !== null && amountCents === ctx.balanceCents;
  if (completes && ctx.grantsMembership) {
    periodStart = periodStart ?? ctx.invoicePeriod.start;
    periodEnd = periodEnd ?? ctx.invoicePeriod.end;
    if (!periodStart || !isValidIsoDate(periodStart)) errors.periodStart = "Enter the date membership starts.";
    if (!periodEnd || !isValidIsoDate(periodEnd)) errors.periodEnd = "Enter the date membership ends.";
    if (!errors.periodStart && !errors.periodEnd && periodEnd! < periodStart!) {
      errors.periodEnd = "The end date must be after the start date.";
    }
  } else {
    periodStart = null; // only used when this payment settles the invoice
    periodEnd = null;
  }

  if (Object.keys(errors).length > 0 || amountCents === null || !method) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    data: { amount: centsToDecimal(amountCents), amountCents, method, paidOn, reference, periodStart, periodEnd },
  };
}

// ---------------------------------------------------------------------------
// Database error codes to plain language
// ---------------------------------------------------------------------------

const ERROR_TEXT: Record<string, string> = {
  member_not_found: "That member could not be found.",
  invoice_not_found: "That invoice could not be found.",
  invoice_not_payable: "This invoice is already paid or cancelled, so it cannot take another payment.",
  amount_invalid: "The amount is not valid for this invoice.",
  date_invalid: "The payment date cannot be in the future.",
  due_date_invalid: "The due date cannot be in the past.",
  no_items: "Add at least one line to the invoice.",
  period_required: "Enter the dates this payment covers.",
  period_overlaps:
    "That membership period overlaps one already recorded for this member. Choose dates that start after the current period ends.",
};

export function billingErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = message.match(/DPMM:(\w+)/)?.[1];
  return (code && ERROR_TEXT[code]) || "Sorry, something went wrong and nothing was saved. Please try again.";
}
