import type { Metadata } from "next";
import { requireUser } from "@/modules/auth/dal";
import { DPMM_LOGO_DATA_URI } from "@/lib/logo";
import { SignOutButton } from "@/modules/auth/sign-out-button";

export const metadata: Metadata = { title: "Member portal" };

export default async function PortalPage() {
  const user = await requireUser("/portal");

  return (
    <>
      <header className="border-b-4 border-accent bg-primary text-cream">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <img
            src={DPMM_LOGO_DATA_URI}
            alt="Dewan Perniagaan Melayu Malaysia (DPMM) Putrajaya"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-full bg-cream object-contain p-1"
          />
          <div className="leading-tight">
            <span className="block font-display text-xl font-semibold tracking-tight">
              DPMM Putrajaya
            </span>
            <span className="block text-xs font-medium text-cream/70">
              Dewan Perniagaan Melayu Malaysia
            </span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden text-sm text-cream/80 sm:inline">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="font-display text-4xl font-bold tracking-tight text-primary">Member portal</h1>
        <p className="mt-4 max-w-prose text-lg">
          Your profile, invoices and renewals will appear here soon.
        </p>
      </main>
    </>
  );
}
