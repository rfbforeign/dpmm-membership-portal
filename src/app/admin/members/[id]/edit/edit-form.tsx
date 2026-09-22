"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateMember } from "@/modules/members/actions";
import type { MemberFormState } from "@/modules/members/types";

type Option = { value: string; label: string };

export interface EditFormProps {
  memberId: string;
  cancelHref: string;
  initial: Record<string, string>;
  options: {
    statuses: Option[];
    types: Option[];
    sectors: Option[];
    businessTypes: Option[];
    introducers: Option[];
  };
}

const inputClass =
  "mt-1.5 block w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-base text-primary-deep aria-[invalid=true]:border-accent aria-[invalid=true]:border-2";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-10">
      <legend className="font-display text-xl font-semibold text-primary">{title}</legend>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function EditForm({ memberId, cancelHref, initial, options }: EditFormProps) {
  const [state, formAction, pending] = useActionState<MemberFormState, FormData>(updateMember, undefined);

  const value = (name: string) => state?.values?.[name] ?? initial[name] ?? "";
  const errorFor = (name: string) => state?.fieldErrors?.[name];

  function field(
    name: string,
    label: string,
    opts: { type?: string; hint?: string; wide?: boolean; autoComplete?: string; required?: boolean } = {}
  ) {
    const error = errorFor(name);
    return (
      <div className={opts.wide ? "sm:col-span-2" : ""}>
        <label htmlFor={name} className="block text-sm font-semibold text-primary">{label}</label>
        <input
          id={name}
          name={name}
          type={opts.type ?? "text"}
          defaultValue={value(name)}
          autoComplete={opts.autoComplete ?? "off"}
          required={opts.required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : opts.hint ? `${name}-hint` : undefined}
          className={inputClass}
        />
        {opts.hint && !error && <p id={`${name}-hint`} className="mt-1.5 text-sm text-primary-deep/70">{opts.hint}</p>}
        {error && <p id={`${name}-error`} className="mt-1.5 text-sm font-semibold text-accent">{error}</p>}
      </div>
    );
  }

  function area(name: string, label: string, rows = 3) {
    const error = errorFor(name);
    return (
      <div className="sm:col-span-2">
        <label htmlFor={name} className="block text-sm font-semibold text-primary">{label}</label>
        <textarea
          id={name}
          name={name}
          rows={rows}
          defaultValue={value(name)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          className={inputClass}
        />
        {error && <p id={`${name}-error`} className="mt-1.5 text-sm font-semibold text-accent">{error}</p>}
      </div>
    );
  }

  function select(name: string, label: string, list: Option[], opts: { blank?: string; required?: boolean } = {}) {
    const error = errorFor(name);
    return (
      <div>
        <label htmlFor={name} className="block text-sm font-semibold text-primary">{label}</label>
        <select
          id={name}
          name={name}
          defaultValue={value(name)}
          required={opts.required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          className={inputClass}
        >
          {opts.blank !== undefined && <option value="">{opts.blank}</option>}
          {list.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && <p id={`${name}-error`} className="mt-1.5 text-sm font-semibold text-accent">{error}</p>}
      </div>
    );
  }

  return (
    // Re-mounting on each failed save makes the fields show what the person typed, not the reset values
    <form action={formAction} key={state?.values ? JSON.stringify(state.values) : "initial"}>
      <input type="hidden" name="memberId" value={memberId} />

      {state?.error && (
        <div role="alert" className="mt-6 border-l-4 border-accent bg-paper px-4 py-3">
          {state.error}
        </div>
      )}

      <Section title="Name and contact">
        {field("fullName", "Full name", { required: true, autoComplete: "off" })}
        {field("companyName", "Company or business name")}
        {field("email", "Email", { type: "email", required: true })}
        {field("phone", "Phone", { type: "tel", hint: "For example 012-3456789. Saved as +60123456789." })}
        {field("officeTel", "Office phone", { type: "tel" })}
        {area("mailingAddress", "Mailing address")}
        {area("registeredAddress", "Registered address")}
      </Section>

      <Section title="Membership">
        {select("status", "Status", options.statuses, { required: true })}
        {select("membershipTypeId", "Membership type", options.types, { required: true })}
        {field("joinedDate", "Joined date", { type: "date", required: true })}
        {select("introducerId", "Introduced by", options.introducers, { blank: "None" })}
      </Section>

      <Section title="Identity and business">
        {field("icNo", "IC number", { hint: "12 digits, like 800101-01-5555." })}
        {field("ssmNo", "SSM / registration number")}
        {select("businessSectorId", "Business sector", options.sectors, { blank: "Not set" })}
        {select("businessTypeId", "Business type", options.businessTypes, { blank: "Not set" })}
      </Section>

      <Section title="Internal notes">
        {area("adminNotes", "Notes (visible to staff only)", 4)}
      </Section>

      <div className="mt-10 flex items-center gap-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-6 py-3 font-semibold text-cream hover:bg-primary-deep disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save changes"}
        </button>
        <Link href={cancelHref} className="font-semibold text-primary underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
