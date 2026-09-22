import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";
import { getMemberOptions, listMembers, PAGE_SIZE, type MemberFilters } from "@/modules/members/queries";
import { StatusBadge, STATUS_LABEL } from "@/modules/members/status-badge";
import { MEMBER_STATUSES } from "@/modules/members/validation";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";

const number = new Intl.NumberFormat("en-MY");
const control =
  "rounded-md border border-line bg-paper px-3 py-2 text-base text-primary-deep";

function pageHref(filters: { q?: string; status?: string; typeId?: number }, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.typeId) params.set("type", String(filters.typeId));
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/members?${query}` : "/admin/members";
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<MemberFilters> }) {
  await requireRole(STAFF_ROLES, "/admin/members");
  const raw = await searchParams;
  const [{ rows, total, page, pageCount, filters }, options] = await Promise.all([
    listMembers(raw),
    getMemberOptions(),
  ]);

  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const filtered = Boolean(filters.q || filters.status || filters.typeId);

  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight text-primary">Members</h1>

      <form method="get" className="mt-8 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="block text-sm font-semibold text-primary">Search</label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder="Name, company, membership no, email or phone"
            className={`mt-1.5 block w-full ${control}`}
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-semibold text-primary">Status</label>
          <select id="status" name="status" defaultValue={filters.status ?? ""} className={`mt-1.5 block ${control}`}>
            <option value="">All</option>
            {MEMBER_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="type" className="block text-sm font-semibold text-primary">Type</label>
          <select id="type" name="type" defaultValue={filters.typeId ? String(filters.typeId) : ""} className={`mt-1.5 block ${control}`}>
            <option value="">All</option>
            {options.types.map((t) => (
              <option key={t.id} value={t.id}>{t.fasal}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-md bg-primary px-5 py-2 font-semibold text-cream hover:bg-primary-deep">
          Search
        </button>
        {filtered && (
          <Link href="/admin/members" className="py-2 text-sm font-semibold text-primary underline">
            Clear
          </Link>
        )}
      </form>

      <p className="mt-6 text-sm" aria-live="polite">
        {total === 0 ? "No members match." : `Showing ${number.format(first)} to ${number.format(last)} of ${number.format(total)} members`}
      </p>

      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-md border border-line bg-paper">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <caption className="sr-only">Members</caption>
            <thead>
              <tr className="border-b border-line text-sm text-primary">
                <th scope="col" className="px-4 py-3 font-semibold">No.</th>
                <th scope="col" className="px-4 py-3 font-semibold">Member</th>
                <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{m.membershipNo}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/members/${m.id}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                      {m.fullName}
                    </Link>
                    {m.companyName && <span className="block text-sm text-primary-deep/75">{m.companyName}</span>}
                  </td>
                  <td className="px-4 py-3">{m.fasal}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{m.joinedDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav aria-label="Pages" className="mt-5 flex items-center gap-4">
          {page > 1 ? (
            <Link href={pageHref(filters, page - 1)} className="font-semibold text-primary underline">Previous</Link>
          ) : (
            <span className="text-primary-deep/40">Previous</span>
          )}
          <span className="text-sm">Page {page} of {pageCount}</span>
          {page < pageCount ? (
            <Link href={pageHref(filters, page + 1)} className="font-semibold text-primary underline">Next</Link>
          ) : (
            <span className="text-primary-deep/40">Next</span>
          )}
        </nav>
      )}
    </>
  );
}
