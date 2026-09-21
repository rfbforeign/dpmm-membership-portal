import { and, asc, count, eq, ilike, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  businessSectors,
  businessTypes,
  introducers,
  members,
  membershipTypes,
} from "@/db/schema";
import { escapeLike } from "@/lib/normalize";
import { maskIc } from "@/lib/mask";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";
import { canViewFullIc } from "./permissions";
import { MEMBER_STATUSES, type MemberStatus } from "./validation";

export const PAGE_SIZE = 25;

export interface MemberFilters {
  q?: string;
  status?: string;
  type?: string;
  page?: string;
}

function buildWhere(filters: { q?: string; status?: MemberStatus; typeId?: number }) {
  const conditions = [isNull(members.deletedAt)];

  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    conditions.push(
      or(
        ilike(members.fullName, pattern),
        ilike(members.companyName, pattern),
        ilike(members.membershipNo, pattern),
        ilike(members.legacyMembershipNo, pattern),
        ilike(members.email, pattern),
        ilike(members.phone, pattern)
      )!
    );
  }
  if (filters.status) conditions.push(eq(members.status, filters.status));
  if (filters.typeId) conditions.push(eq(members.membershipTypeId, filters.typeId));
  return and(...conditions);
}

/** Staff only. Returns one page of members matching the search and filters. */
export async function listMembers(raw: MemberFilters) {
  await requireRole(STAFF_ROLES);

  const q = raw.q?.trim().slice(0, 100) || undefined;
  const status = MEMBER_STATUSES.find((s) => s === raw.status);
  const typeNumber = Number(raw.type);
  const typeId = Number.isInteger(typeNumber) && typeNumber > 0 ? typeNumber : undefined;
  const requestedPage = Number(raw.page);
  const where = buildWhere({ q, status, typeId });

  const db = getDb();
  const [{ total }] = await db.select({ total: count() }).from(members).where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(Number.isInteger(requestedPage) ? requestedPage : 1, 1), pageCount);

  const rows = await db
    .select({
      id: members.id,
      membershipNo: members.membershipNo,
      fullName: members.fullName,
      companyName: members.companyName,
      status: members.status,
      joinedDate: members.joinedDate,
      phone: members.phone,
      fasal: membershipTypes.fasal,
    })
    .from(members)
    .innerJoin(membershipTypes, eq(members.membershipTypeId, membershipTypes.id))
    .where(where)
    .orderBy(asc(members.membershipNo))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return { rows, total, page, pageCount, filters: { q, status, typeId } };
}

/** Lists used by the filter bar and the edit form. */
export async function getMemberOptions() {
  await requireRole(STAFF_ROLES);
  const db = getDb();
  const [types, sectors, businessTypeRows, introducerRows] = await Promise.all([
    db.select().from(membershipTypes).orderBy(asc(membershipTypes.sortOrder)),
    db.select().from(businessSectors).orderBy(asc(businessSectors.name)),
    db.select().from(businessTypes).orderBy(asc(businessTypes.name)),
    db.select().from(introducers).orderBy(asc(introducers.name)),
  ]);
  return { types, sectors, businessTypes: businessTypeRows, introducers: introducerRows };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Staff only. One member with readable names for the lookups.
 * The IC number comes back masked unless the person's role may see it in full.
 */
export async function getMember(id: string) {
  const user = await requireRole(STAFF_ROLES);
  if (!UUID.test(id)) return null;

  const [row] = await getDb()
    .select({
      member: members,
      typeFasal: membershipTypes.fasal,
      typeCategory: membershipTypes.category,
      sectorName: businessSectors.name,
      businessTypeName: businessTypes.name,
      introducerName: introducers.name,
    })
    .from(members)
    .innerJoin(membershipTypes, eq(members.membershipTypeId, membershipTypes.id))
    .leftJoin(businessSectors, eq(members.businessSectorId, businessSectors.id))
    .leftJoin(businessTypes, eq(members.businessTypeId, businessTypes.id))
    .leftJoin(introducers, eq(members.introducerId, introducers.id))
    .where(and(eq(members.id, id), isNull(members.deletedAt)))
    .limit(1);

  if (!row) return null;

  const fullIc = canViewFullIc(user.role);
  const legacy = (row.member.legacyData ?? {}) as Record<string, unknown>;
  return {
    ...row,
    member: { ...row.member, icNo: fullIc ? row.member.icNo : maskIc(row.member.icNo) },
    legacy: {
      receiptNo: typeof legacy.receiptNo === "string" ? legacy.receiptNo : null,
      paymentNotes: typeof legacy.paymentNotes === "string" ? legacy.paymentNotes : null,
    },
    icHidden: !fullIc,
  };
}
