import { NextResponse } from "next/server";
import { getSession } from "@/modules/auth/session";
import { getPortalMemberData } from "@/modules/portal/queries";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getPortalMemberData(session.user.id, session.user.email);
    if (!data) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Portal member API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch member data" },
      { status: 500 }
    );
  }
}