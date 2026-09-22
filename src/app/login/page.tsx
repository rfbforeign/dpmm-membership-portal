import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/modules/auth/dal";
import { roleHome } from "@/modules/auth/roles";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safe = safeNext(next);

  const user = await getCurrentUser();
  if (user) redirect(safe ?? roleHome(user.role));

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="border-b-4 border-accent bg-primary px-8 py-8 text-cream lg:border-b-0 lg:border-r-4 lg:px-14 lg:py-14">
        <Link href="/" className="flex items-center gap-3">
          <span aria-hidden="true" className="h-6 w-6 rounded-sm bg-accent" />
          <span className="font-display text-xl font-semibold tracking-tight">DPMM Putrajaya</span>
        </Link>
        <div className="mt-10 hidden max-w-sm lg:mt-32 lg:block">
          <p className="font-display text-4xl font-bold leading-tight tracking-tight">
            Membership, in one place.
          </p>
          <p className="mt-4 text-cream/75">
            Records, fees and renewals for every DPMM member, kept safe and easy to find.
          </p>
        </div>
      </aside>

      <main className="flex items-center px-8 py-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold tracking-tight text-primary">Sign in</h1>
          <p className="mt-2">Use the email and password for your DPMM account.</p>
          <LoginForm next={safe ?? undefined} />
        </div>
      </main>
    </div>
  );
}
