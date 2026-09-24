import type { Metadata } from "next";
import Link from "next/link";
import { formatRM } from "@/lib/money";
import { hasBankDetails, ORG } from "@/lib/org";
import { DPMM_LOGO_DATA_URI } from "@/lib/logo";

export const metadata: Metadata = { title: "Application received" };

// Only ever show values that look like ours; anything else in the address bar is ignored
const MEMBERSHIP_NO = /^PJ-\d{4}-\d{4,}$/;
const INVOICE_NO = /^INV-\d{4}-\d{4,}$/;
const AMOUNT = /^\d{1,7}\.\d{2}$/;

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string; inv?: string; amt?: string }>;
}) {
  const { no, inv, amt } = await searchParams;
  const membershipNo = no && MEMBERSHIP_NO.test(no) ? no : null;
  const invoiceNo = inv && INVOICE_NO.test(inv) ? inv : null;
  const amount = amt && AMOUNT.test(amt) ? amt : null;
  const showInvoice = Boolean(invoiceNo && amount);

  return (
    <>
      <header className="border-b-4 border-accent bg-primary text-cream">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <img
            src={DPMM_LOGO_DATA_URI}
            alt="DPMM Putrajaya"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded-full bg-cream object-contain p-0.5"
          />
            <span className="font-display text-xl font-semibold tracking-tight">DPMM Putrajaya</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-primary sm:text-5xl">
          Application received
        </h1>
        <p className="mt-4 max-w-prose text-lg">Thank you for applying to join DPMM Putrajaya.</p>

        <div className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
          {membershipNo && (
            <div className="rounded-md border border-line bg-paper px-6 py-5">
              <p className="text-sm text-primary-deep/75">Your application number</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-primary">
                {membershipNo}
              </p>
            </div>
          )}
          {showInvoice && (
            <div className="rounded-md border border-line bg-paper px-6 py-5">
              <p className="text-sm text-primary-deep/75">Amount to pay</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-primary">
                {formatRM(amount!)}
              </p>
              <p className="mt-1 text-sm tabular-nums text-primary-deep/75">Invoice {invoiceNo}</p>
            </div>
          )}
        </div>
        {membershipNo && (
          <p className="mt-3 text-sm text-primary-deep/75">Please keep these numbers and quote them if you contact us.</p>
        )}

        {showInvoice && hasBankDetails() && (
          <section className="mt-8 max-w-2xl rounded-md border border-line bg-paper px-6 py-5">
            <h2 className="font-display text-xl font-semibold text-primary">How to pay</h2>
            <p className="mt-2">
              {ORG.bank.bankName}
              {ORG.bank.accountName ? `, ${ORG.bank.accountName}` : ""}
            </p>
            <p className="tabular-nums">Account number: {ORG.bank.accountNumber}</p>
            <p className="mt-2 text-sm">
              Use <strong>{invoiceNo}</strong> as the payment reference.
            </p>
          </section>
        )}

        <h2 className="mt-10 font-display text-xl font-semibold text-primary">What happens next</h2>
        <ol className="mt-3 max-w-prose list-decimal space-y-2 pl-6">
          <li>The secretariat reviews your application.</li>
          <li>
            {showInvoice && hasBankDetails()
              ? "Pay the amount above within 14 days."
              : "We contact you with the payment details for your registration and first year fee."}
          </li>
          <li>Once payment is confirmed, your membership becomes active.</li>
        </ol>

        <Link href="/" className="mt-10 inline-block font-semibold text-primary underline">
          Back to the home page
        </Link>
      </main>
    </>
  );
}
