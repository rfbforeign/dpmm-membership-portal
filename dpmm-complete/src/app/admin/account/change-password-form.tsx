"use client";

import { useActionState } from "react";
import { changePassword } from "@/modules/auth/actions";
import type { FormState } from "@/modules/auth/types";

const inputClass =
  "mt-1.5 block w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-base text-primary-deep";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(changePassword, undefined);

  return (
    <form action={formAction} className="mt-6 max-w-md space-y-5">
      {state?.error && (
        <div role="alert" className="border-l-4 border-accent bg-paper px-4 py-3 text-sm">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div role="status" className="border-l-4 border-primary bg-paper px-4 py-3 text-sm">
          {state.success}
        </div>
      )}

      <div>
        <label htmlFor="current" className="block text-sm font-semibold text-primary">
          Current password
        </label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className={inputClass} />
      </div>

      <div>
        <label htmlFor="proposed" className="block text-sm font-semibold text-primary">
          New password
        </label>
        <input id="proposed" name="proposed" type="password" autoComplete="new-password" minLength={12} required className={inputClass} />
        <p className="mt-1.5 text-sm text-primary-deep/70">
          At least 12 characters. A short phrase of several words is easy to remember and hard to guess.
        </p>
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm font-semibold text-primary">
          Repeat new password
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-5 py-2.5 font-semibold text-cream hover:bg-primary-deep disabled:opacity-60"
      >
        {pending ? "Saving..." : "Update password"}
      </button>
    </form>
  );
}
