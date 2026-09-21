"use client";

import { useActionState } from "react";
import { login } from "@/modules/auth/actions";
import type { FormState } from "@/modules/auth/types";

const inputClass =
  "mt-1.5 block w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-base text-primary-deep placeholder:text-primary-deep/40";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(login, undefined);

  return (
    <form action={formAction} key={state?.email ?? ""} className="mt-8 space-y-5" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />

      {state?.error && (
        <div role="alert" className="border-l-4 border-accent bg-paper px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-primary">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state?.email ?? ""}
          autoFocus={!state?.email}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-primary">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus={Boolean(state?.email)}
          required
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary px-4 py-3 text-base font-semibold text-cream hover:bg-primary-deep disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
