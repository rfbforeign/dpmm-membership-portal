import Link from "next/link";
import { asc } from "drizzle-orm";
import { DPMM_LOGO_DATA_URI } from "@/lib/logo";
import { getDb } from "@/db";
import { membershipTypes } from "@/db/schema";
import { formatRM } from "@/lib/money";

// Always read fresh data from the database
export const dynamic = "force-dynamic";

async function loadMembershipTypes() {
  try {
    const rows = await getDb()
      .select()
      .from(membershipTypes)
      .orderBy(asc(membershipTypes.sortOrder));
    return { ok: true as const, rows };
  } catch (error) {
    console.error("Could not load membership types", error);
    return { ok: false as const, rows: [] };
  }
}

export default async function HomePage() {
  const { ok, rows } = await loadMembershipTypes();

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
          <Link
            href="/login"
            className="ml-auto rounded-md border border-current px-3 py-1.5 text-sm font-semibold hover:bg-white/10"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-primary sm:text-5xl">
          Membership fees
        </h1>
        <p className="mt-4 max-w-prose text-lg">
          Registration and annual fees for each membership category under Fasal 6.2 of the
          Dewan Perniagaan Melayu Malaysia (DPMM) constitution.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-block rounded-md bg-accent px-6 py-3 text-lg font-semibold text-white hover:opacity-90"
        >
          Apply for membership
        </Link>

        {!ok && (
          <div
            role="alert"
            className="mt-10 border-l-4 border-accent bg-paper px-5 py-4"
          >
            <p className="font-semibold text-primary">Can&apos;t reach the database</p>
            <p className="mt-1">
              Check that <code>DATABASE_URL</code> is set in <code>.env.local</code> (or in
              the Vercel project settings) and points to your Neon database.
            </p>
          </div>
        )}

        {ok && (
          <>
            <div className="mt-10 overflow-x-auto rounded-md border border-line bg-paper">
              <table className="w-full min-w-[36rem] border-collapse text-left">
                <caption className="sr-only">
                  Membership categories with registration and annual fees in Malaysian Ringgit
                </caption>
                <thead>
                  <tr className="border-b border-line text-sm text-primary">
                    <th scope="col" className="px-5 py-3 font-semibold">Fasal</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Category</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Registration</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Annual</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((type) => (
                    <tr key={type.id} className="border-b border-line last:border-b-0">
                      <th scope="row" className="px-5 py-4 font-semibold text-primary">
                        {type.fasal}
                      </th>
                      <td className="px-5 py-4">{type.category}</td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {formatRM(type.registrationFee)}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {formatRM(type.annualFee)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-primary-deep/70">
              Read live from the membership database.
            </p>
          </>
        )}
      </main>
    </>
  );
}
