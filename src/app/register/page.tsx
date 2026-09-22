import type { Metadata } from "next";
import Link from "next/link";
import { formatRM } from "@/lib/money";
import { getRegistrationOptions } from "@/modules/registration/queries";
import { RegisterForm, type TypeChoice } from "./register-form";

export const metadata: Metadata = {
  title: "Apply for membership",
  description: "Apply to become a member of DPMM Putrajaya.",
};
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  let options: Awaited<ReturnType<typeof getRegistrationOptions>> | null = null;
  try {
    options = await getRegistrationOptions();
  } catch (error) {
    console.error("Could not load registration options", error);
  }

  const types: TypeChoice[] = (options?.types ?? []).map((t) => ({
    id: String(t.id),
    fasal: t.fasal,
    category: t.category,
    registrationFee: formatRM(t.registrationFee),
    annualFee: formatRM(t.annualFee),
    dueNow: formatRM(Number(t.registrationFee) + Number(t.annualFee)),
  }));

  return (
    <>
      <header className="border-b-4 border-accent bg-primary text-cream">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span aria-hidden="true" className="h-6 w-6 rounded-sm bg-accent" />
            <span className="font-display text-xl font-semibold tracking-tight">DPMM Putrajaya</span>
          </Link>
          <Link
            href="/login"
            className="ml-auto rounded-md border border-current px-3 py-1.5 text-sm font-semibold hover:bg-white/10"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-primary sm:text-5xl">
          Apply for membership
        </h1>
        <p className="mt-4 max-w-prose text-lg">
          Fill in the form below. The secretariat will review your application and contact you about payment.
          Fields marked <span className="font-semibold text-accent">*</span> are required.
        </p>

        {options ? (
          <RegisterForm
            types={types}
            sectors={options.sectors.map((s) => ({ value: String(s.id), label: s.name }))}
            businessTypes={options.businessTypes.map((b) => ({ value: String(b.id), label: b.name }))}
          />
        ) : (
          <div role="alert" className="mt-10 border-l-4 border-accent bg-paper px-5 py-4">
            <p className="font-semibold text-primary">The application form isn&apos;t available right now</p>
            <p className="mt-1">Please try again in a few minutes, or contact the DPMM secretariat.</p>
          </div>
        )}
      </main>
    </>
  );
}
