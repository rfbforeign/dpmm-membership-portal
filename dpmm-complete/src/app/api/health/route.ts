import { count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { membershipTypes } from "@/db/schema";

export const dynamic = "force-dynamic";

/** GET /api/health: confirms the app can reach the database. Returns no member data. */
export async function GET() {
  try {
    const [row] = await getDb().select({ total: count() }).from(membershipTypes);
    return NextResponse.json({ status: "ok", database: "connected", membershipTypes: row.total });
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
