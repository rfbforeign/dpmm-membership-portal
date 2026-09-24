import Link from "next/link";
import { DPMM_LOGO_DATA_URI } from "@/lib/logo";
import { requireRole } from "@/modules/auth/dal";
import { ROLE_LABEL, STAFF_ROLES } from "@/modules/auth/roles";
import { SignOutButton } from "@/modules/auth/sign-out-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(STAFF_ROLES);

  return (
    <div className="min-h-dvh">
      <header className="border-b-4 border-accent bg-primary text-cream print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
          <Link href="/admin" className="flex items-center gap-3">
            <img
            src={DPMM_LOGO_DATA_URI}
            alt="DPMM Putrajaya"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded-full bg-cream object-contain p-0.5"
          />
            <span className="font-display text-xl font-semibold tracking-tight">DPMM Putrajaya</span>
          </Link>

          <nav aria-label="Admin" className="flex gap-5 text-sm font-semibold">
            <Link href="/admin" className="hover:underline">Dashboard</Link>
            <Link href="/admin/members" className="hover:underline">Members</Link>
            <Link href="/admin/invoices" className="hover:underline">Invoices</Link>
            <Link href="/admin/notifications" className="hover:underline">Renewals</Link>
            <Link href="/admin/account" className="hover:underline">Account</Link>
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <p className="text-right text-sm leading-tight text-cream/80">
              <span className="block">{user.email}</span>
              <span className="block text-xs">{ROLE_LABEL[user.role]}</span>
            </p>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
