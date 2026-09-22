"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createInvoice } from "@/modules/billing/actions";
import type { MemberFormState } from "@/modules/members/types";

interface Props {
  memberId: string;
  invoiceType: "registration" | "renewal" | "other";
  cancelHref: string;
  initial: {
    description: string;
    dueDate: string;
    periodStart: string;
    periodEnd: string;
    items: { description: string; quantity: string; amount: string }[];
  };
  rows: number;
}

const inputClass =
  "mt-1.5 block w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-base text-primary-deep aria-[invalid=true]:border-accent aria-[invalid=true]:border-2";

export function NewInvoiceForm({ memberId, invoiceType, cancelHref, initial, rows }: Props) {
  const [state, formAction, pending] = useActionState<MemberFormState, FormData>(createInvoice, undefined);

  const value = (name: string, fallback: string) => state?.values?.[name] ?? fallback;
  const errorFor = (name: string) => state?.fieldErrors?.[name];
  const showPeriod = invoiceType !== "other";

  function err(name: string) {
    const e = errorFor(name);
    return e ? <p id={`${name}-error`} className="mt-1.5 text-sm font-semibold text-accent">{e}</p> : null;
  }

  return (
    <form action={formAction} key={state?.values ? JSON.stringify(state.values) : "initial"} className="mt-8">
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="invoiceType" value={invoiceType} />

      {state?.error && (
        <div role="alert" className="mb-6 border-l-4 border-accent bg-paper px-4 py-3">{state.error}</div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="description" className="block text-sm font-semibold text-primary">Description (optional)</label>
          <input id="description" name="description" defaultValue={value("description", initial.description)} className={inputClass} />
          {err("description")}
        </div>

        <div>
          <label htmlFor="dueDate" className="block text-sm font-semibold text-primary">Due date</label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            required
            defaultValue={value("dueDate", initial.dueDate)}
            aria-invalid={errorFor("dueDate") ? true : undefined}
            className={inputClass}
          />
          {err("dueDate")}
        </div>
      </div>

      {showPeriod && (
        <fieldset className="mt-8">
          <legend className="font-display text-xl font-semibold text-primary">Membership period this covers</legend>
          <p className="mt-1 text-primary-deep/75">
            Membership is extended over these dates once the invoice is paid in full. For several years paid at once, set a later end date.
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="periodStart" className="block text-sm font-semibold text-primary">From</label>
              <input
                id="periodStart"
                name="periodStart"
                type="date"
                defaultValue={value("periodStart", initial.periodStart)}
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
                defaultValue={value("periodEnd", initial.periodEnd)}
                aria-invalid={errorFor("periodEnd") ? true : undefined}
                className={inputClass}
              />
              {err("periodEnd")}
            </div>
          </div>
        </fieldset>
      )}

      <fieldset className="mt-8">
        <legend className="font-display text-xl font-semibold text-primary">Lines</legend>
        {errorFor("items") && <p className="mt-2 text-sm font-semibold text-accent">{errorFor("items")}</p>}
        <div className="mt-4 space-y-4">
          {Array.from({ length: rows }, (_, i) => i + 1).map((n) => {
            const seed = initial.items[n - 1];
            return (
              <div key={n} className="grid gap-3 sm:grid-cols-[1fr_6rem_9rem]">
                <div>
                  <label htmlFor={`item${n}Description`} className="block text-sm font-semibold text-primary">
                    Line {n}
                  </label>
                  <input
                    id={`item${n}Description`}
                    name={`item${n}Description`}
                    defaultValue={value(`item${n}Description`, seed?.description ?? "")}
                    aria-invalid={errorFor(`item${n}Description`) ? true : undefined}
                    className={inputClass}
                  />
                  {err(`item${n}Description`)}
                </div>
                <div>
                  <label htmlFor={`item${n}Quantity`} className="block text-sm font-semibold text-primary">Qty</label>
                  <input
                    id={`item${n}Quantity`}
                    name={`item${n}Quantity`}
                    inputMode="numeric"
                    defaultValue={value(`item${n}Quantity`, seed?.quantity ?? "")}
                    aria-invalid={errorFor(`item${n}Quantity`) ? true : undefined}
                    className={inputClass}
                  />
                  {err(`item${n}Quantity`)}
                </div>
                <div>
                  <label htmlFor={`item${n}Amount`} className="block text-sm font-semibold text-primary">Price each (RM)</label>
                  <input
                    id={`item${n}Amount`}
                    name={`item${n}Amount`}
                    inputMode="decimal"
                    defaultValue={value(`item${n}Amount`, seed?.amount ?? "")}
                    aria-invalid={errorFor(`item${n}Amount`) ? true : undefined}
                    className={inputClass}
                  />
                  {err(`item${n}Amount`)}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-primary-deep/70">Leave unused lines empty. The total is worked out for you.</p>
      </fieldset>

      <div className="mt-10 flex items-center gap-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-6 py-3 font-semibold text-cream hover:bg-primary-deep disabled:opacity-60"
        >
          {pending ? "Creating..." : "Create invoice"}
        </button>
        <Link href={cancelHref} className="font-semibold text-primary underline">Cancel</Link>
      </div>
    </form>
  );
}
