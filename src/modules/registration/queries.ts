import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { businessSectors, businessTypes, membershipTypes } from "@/db/schema";

/**
 * Readable by anyone (the registration page is public), so this returns ONLY the
 * membership categories, fees and business categories. Never add member data here.
 */
export async function getRegistrationOptions() {
  const db = getDb();
  const [types, sectors, businessTypeRows] = await Promise.all([
    db.select().from(membershipTypes).where(eq(membershipTypes.isActive, true)).orderBy(asc(membershipTypes.sortOrder)),
    db.select().from(businessSectors).orderBy(asc(businessSectors.name)),
    db.select().from(businessTypes).orderBy(asc(businessTypes.name)),
  ]);
  return { types, sectors, businessTypes: businessTypeRows };
}
