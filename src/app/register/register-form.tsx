"use client";

import { useActionState } from "react";
import { registerMember } from "@/modules/registration/actions";
import type { MemberFormState } from "@/modules/members/types";

export interface TypeChoice {
  id: string;
  fasal: string;
  category: string;
  registrationFee: string; // already formatted, e.g. "RM 50.00"
  annualFee: string;
  dueNow: string;
}

interface Props {
  types: TypeChoice[];
  sectors: { value: string; label: string }[];
  businessTypes: { value: string; label: string }[];
}

const inputClass =
  "mt-1.5 block w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-base text-primary-deep aria-[invalid=true]:border-accent aria-[invalid=true]:border-2";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-12">
      <legend className="font-display text-2xl font-semibold text-primary">{title}</legend>
      {hint && <p className="mt-1 text-primary-deep/75">{hint}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function RegisterForm({ types, sectors, businessTypes }: Props) {
  const [state, formAction, pending] = useActionState<MemberFormState, FormData>(registerMember, undefined);

  const value = (name: string) => state?.values?.[name] ?? "";
  const errorFor = (name: string) => state?.fieldErrors?.[name];

  function field(
    name: string,
    label: string,
    opts: { type?: string; hint?: string; wide?: boolean; autoComplete?: string; required?: boolean } = {}
  ) {
    const error = errorFor(name);
    return (
      <div className={opts.wide ? "sm:col-span-2" : ""}>
        <label htmlFor={name} className="block text-sm font-semibold text-primary">
          {label}
          {opts.required && <span className="text-accent"> *</span>}
        </label>
        <input
          id={name}
          name={name}
          type={opts.type ?? "text"}
          defaultValue={value(name)}
          autoComplete={opts.autoComplete ?? "off"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : opts.hint ? `${name}-hint` : undefined}
          className={inputClass}
        />
        {opts.hint && !error && <p id={`${name}-hint`} className="mt-1.5 text-sm text-primary-deep/70">{opts.hint}</p>}
        {error && <p id={`${name}-error`} className="mt-1.5 text-sm font-semibold text-accent">{error}</p>}
      </div>
    );
  }

  function area(name: string, label: string, opts: { required?: boolean; hint?: string } = {}) {
    const error = errorFor(name);
    return (
      <div className="sm:col-span-2">
        <label htmlFor={name} className="block text-sm font-semibold text-primary">
          {label}
          {opts.required && <span className="text-accent"> *</span>}
        </label>
        <textarea
          id={name}
          name={name}
          rows={3}
          defaultValue={value(name)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : opts.hint ? `${name}-hint` : undefined}
          className={inputClass}
        />
        {opts.hint && !error && <p id={`${name}-hint`} className="mt-1.5 text-sm text-primary-deep/70">{opts.hint}</p>}
        {error && <p id={`${name}-error`} className="mt-1.5 text-sm font-semibold text-accent">{error}</p>}
      </div>
    );
  }

  function select(name: string, label: string, list: { value: string; label: string }[]) {
    const error = errorFor(name);
    return (
      <div>
        <label htmlFor={name} className="block text-sm font-semibold text-primary">{label}</label>
        <select
          id={name}
          name={name}
          defaultValue={value(name)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          className={inputClass}
        >
          <option value="">Choose one</option>
          {list.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && <p id={`${name}-error`} className="mt-1.5 text-sm font-semibold text-accent">{error}</p>}
      </div>
    );
  }

  const typeError = errorFor("membershipTypeId");
  const consentError = errorFor("consent");

  return (
    // Re-mounting after a failed submit shows what the person typed instead of blank fields
    <form action={formAction} key={state?.values ? JSON.stringify(state.values) : "initial"} noValidate>
      {state?.error && (
        <div role="alert" className="mt-8 border-l-4 border-accent bg-paper px-4 py-3">
          {state.error}
        </div>
      )}

      {/* Honeypot: hidden from people, irresistible to bots */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }}>
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset className="mt-10" aria-describedby={typeError ? "type-error" : undefined}>
        <legend className="font-display text-2xl font-semibold text-primary">
          Type of membership <span className="text-accent">*</span>
        </legend>
        <div className="mt-5 grid gap-3">
          {types.map((t) => (
            <label
              key={t.id}
              className="flex cursor-pointer gap-4 rounded-md border border-line bg-paper p-4 has-[:checked]:border-2 has-[:checked]:border-primary"
            >
              <input
                type="radio"
                name="membershipTypeId"
                value={t.id}
                defaultChecked={value("membershipTypeId") === t.id}
                className="mt-1 h-5 w-5 accent-[var(--color-primary)]"
              />
              <span>
                <span className="block font-semibold text-primary">{t.fasal}: {t.category}</span>
                <span className="mt-1 block text-sm text-primary-deep/80">
                  Registration {t.registrationFee} + first year {t.annualFee} ={" "}
                  <strong className="text-primary">{t.dueNow} to pay when you join</strong>
                </span>
              </span>
            </label>
          ))}
        </div>
        {typeError && <p id="type-error" className="mt-2 text-sm font-semibold text-accent">{typeError}</p>}
      </fieldset>

      <Section title="About you" hint="As shown on your IC.">
        {field("fullName", "Full name", { required: true, wide: true, autoComplete: "name" })}
        {field("icNo", "IC number", { required: true, hint: "12 digits, like 800101-01-5555.", autoComplete: "off" })}
        {field("phone", "Mobile phone", { required: true, type: "tel", hint: "For example 012-3456789.", autoComplete: "tel" })}
        {field("email", "Email", { required: true, type: "email", wide: true, autoComplete: "email" })}
      </Section>

      <Section title="Your business" hint="Company and cooperative memberships must fill in the name and SSM number.">
        {field("companyName", "Company, cooperative or business name", { wide: true })}
        {field("ssmNo", "SSM registration number")}
        <div className="hidden sm:block" />
        {select("businessSectorId", "Business sector", sectors)}
        {select("businessTypeId", "Type of business", businessTypes)}
      </Section>

      <Section title="Address">
        {area("registeredAddress", "Registered business address", { required: true })}
        {area("mailingAddress", "Mailing address", { hint: "Only if different from the address above." })}
      </Section>

      <Section title="Introduced by">
        {field("introducedBy", "Name of the DPMM member who introduced you", { wide: true, hint: "Optional." })}
      </Section>

      <div className="mt-12">
        <label
          className={`flex gap-3 rounded-md border bg-paper p-4 ${consentError ? "border-2 border-accent" : "border-line"}`}
        >
          <input
            type="checkbox"
            name="consent"
            defaultChecked={value("consent") === "on"}
            aria-invalid={consentError ? true : undefined}
            aria-describedby={consentError ? "consent-error" : undefined}
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
          />
          <span>
            I confirm the information above is correct. I agree that DPMM may collect and use it to process my
            application and manage my membership, in line with Malaysia&apos;s Personal Data Protection Act 2010.
          </span>
        </label>
        {consentError && <p id="consent-error" className="mt-2 text-sm font-semibold text-accent">{consentError}</p>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-8 w-full rounded-md bg-primary px-6 py-3.5 text-lg font-semibold text-cream hover:bg-primary-deep disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Sending your application..." : "Submit application"}
      </button>
    </form>
  );
}
