"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  businessSectors,
  businessTypes,
  introducers,
  members,
  membershipTypes,
} from "@/db/schema";
import { todayInMalaysia } from "@/lib/normalize";
import { requireRole } from "@/modules/auth/dal";
import { writeAudit } from "@/modules/audit/log";
import { MEMBER_WRITE_ROLES } from "./permissions";
import type { MemberFormState } from "./types";
import { diffMember, validateMemberForm } from "./validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIELDS = [
  "fullName",
  "companyName",
  "email",
  "phone",
  "officeTel",
  "icNo",
  "ssmNo",
  "mailingAddress",
  "registeredAddress",
  "joinedDate",
  "status",
  "membershipTypeId",
  "businessSectorId",
  "businessTypeId",
  "introducerId",
  "adminNotes",
] as const;

export async function updateMember(_previous: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const user = await requireRole(MEMBER_WRITE_ROLES);

  const id = String(formData.get("memberId") ?? "");
  if (!UUID.test(id)) return { error: "That member could not be found." };

  const db = getDb();
  const [existing] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, id), isNull(members.deletedAt)))
    .limit(1);
  if (!existing) return { error: "That member could not be found." };

  const raw: Record<string, string> = {};
  for (const field of FIELDS) raw[field] = String(formData.get(field) ?? "");

  const [typeIds, sectorIds, businessTypeIds, introducerIds] = await Promise.all([
    db.select({ id: membershipTypes.id }).from(membershipTypes),
    db.select({ id: businessSectors.id }).from(businessSectors),
    db.select({ id: businessTypes.id }).from(businessTypes),
    db.select({ id: introducers.id }).from(introducers),
  ]);

  const result = validateMemberForm(raw, {
    today: todayInMalaysia(),
    existing: { icNo: existing.icNo, joinedDate: existing.joinedDate },
    validTypeIds: typeIds.map((r) => r.id),
    validSectorIds: sectorIds.map((r) => r.id),
    validBusinessTypeIds: businessTypeIds.map((r) => r.id),
    validIntroducerIds: introducerIds.map((r) => r.id),
  });

  if (!result.ok) {
    return { error: "Please fix the highlighted fields.", fieldErrors: result.fieldErrors, values: raw };
  }

  const before: Record<string, unknown> = {};
  for (const field of FIELDS) before[field] = existing[field];
  const changes = diffMember(before, result.data as unknown as Record<string, unknown>);

  if (Object.keys(changes).length > 0) {
    try {
      await db.update(members).set(result.data).where(eq(members.id, id));
    } catch (error) {
      console.error("Member update failed", error);
      return { error: "Sorry, the change could not be saved. Please try again.", values: raw };
    }
    await writeAudit({ actorId: user.id, action: "member.update", entityType: "member", entityId: id, changes });
    revalidatePath("/admin/members");
    revalidatePath(`/admin/members/${id}`);
  }

  // redirect() works by throwing, so it stays outside the try/catch
  redirect(`/admin/members/${id}?saved=${Object.keys(changes).length > 0 ? "1" : "0"}`);
}
