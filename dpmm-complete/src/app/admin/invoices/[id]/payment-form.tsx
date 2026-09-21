"use client";

import { useActionState } from "react";
import { recordPayment } from "@/modules/billing/actions";
import type { MemberFormState } from "@/modules/members/types";

interface Props {
  invoiceId: string;
  balance: string; // decimal string, e.g. "250.00"
  today: string;
  grantsMembership: boolean;
  defaultPeriod: { start: string; end: string };
  methods: { value: string; label: string }[];
}

const inputClass =
  "mt-1.5 block w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-base text-primary-deep aria-[invalid=true]:border-accent aria-[invalid=true]:border-2";

export function PaymentForm({ invoiceId, balance, today, grantsMembership, defaultPeriod, methods }: Props) {
  const [state, formAction, pending] = useActionState<MemberFormState, FormData>(recordPayment, undefined);

  const value = (name: string, fallback: string) => state?.values?.[name] ?? fallback;
  const errorFor = (name: string) => state?.fieldErrors?.[name];
  const err = (name: string) =>
    errorFor(name) ? <p className="mt-1.5 text-sm font-semibold text-accent">{errorFor(name)}</p> : null;

  return (
    <form action={formAction} key={state?.values ? JSON.stringify(state.values) : "initial"} className="mt-4 max-w-2xl">
      <input type="hidden" name="invoiceId" value={invoiceId} />

      {state?.error && (
        <div role="alert" className="mb-5 border-l-4 border-accent bg-paper px-4 py-3">{state.error}</div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="amount" className="block text-sm font-semibold text-primary">Amount received (RM)</label>
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            required
            defaultValue={value("amount", balance)}
            aria-invalid={errorFor("amount") ? true : undefined}
            className={inputClass}
          />
          {err("amount")}
        </div>

        <div>
          <label htmlFor="paidOn" className="block text-sm font-semibold text-primary">Date received</label>
          <input
            id="paidOn"
            name="paidOn"
            type="date"
            max={today}
            required
            defaultValue={value("paidOn", today)}
            aria-invalid={errorFor("paidOn") ? true : undefined}
            className={inputClass}
          />
          {err("paidOn")}
        </div>

        <div>
          <label htmlFor="method" className="block text-sm font-semibold text-primary">How it was paid</label>
          <select id="method" name="method" defaultValue={value("method", "bank_transfer")} className={inputClass}>
            {methods.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          {err("method")}
        </div>

        <div>
          <label htmlFor="reference" className="block text-sm font-semibold text-primary">Bank reference (optional)</label>
          <input id="reference" name="reference" defaultValue={value("reference", "")} className={inputClass} />
          {err("reference")}
        </div>
      </div>

      {grantsMembership && (
        <fieldset className="mt-6">
          <legend className="font-semibold text-primary">Membership this payment covers</legend>
          <p className="mt-1 text-sm text-primary-deep/75">
            Used when this payment settles the invoice in full. The member is then marked active and paid until the last day below.
          </p>
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="periodStart" className="block text-sm font-semibold text-primary">From</label>
              <input
                id="periodStart"
                name="periodStart"
                type="date"
                defaultValue={value("periodStart", defaultPeriod.start)}
                aria-invalid={errorFor("periodStart") ? true : undefined}
                className={inputClass}
              />
              {err("periodStart")}
            </div>
            <div>
              <label htmlFor="periodEnd" className="block text-sm font-semibold text-primary">Until (last day)</label>
              <input
                id="periodEnd"
                name="periodEnd"
                type="date"
                defaultValue={value("periodEnd", defaultPeriod.end)}
                aria-invalid={errorFor("periodEnd") ? true : undefined}
                className={inputClass}
              />
              {err("periodEnd")}
            </div>
          </div>
        </fieldset>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 rounded-md bg-primary px-6 py-3 font-semibold text-cream hover:bg-primary-deep disabled:opacity-60"
      >
        {pending ? "Saving..." : "Record payment"}
      </button>
    </form>
  );
}
