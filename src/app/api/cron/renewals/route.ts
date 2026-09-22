import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { getAutomationMode, runDailyAutomation } from "@/modules/notifications/automation";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds; a run sends at most 40 emails

/**
 * Called once a day by Vercel Cron (see vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>".
 * Without CRON_SECRET set, or with the wrong one, nothing runs.
 * The answer lists counts and membership numbers only, never names or emails.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set on the server." }, { status: 503 });
  }
  if (!isAuthorizedCron(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runDailyAutomation(getAutomationMode());
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Cron run crashed", error);
    return NextResponse.json({ error: "The run failed." }, { status: 500 });
  }
}
