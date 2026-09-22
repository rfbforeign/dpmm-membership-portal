"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAudit } from "@/modules/audit/log";
import { requireRole } from "@/modules/auth/dal";
import { sendQueued } from "./outbox";

/** Sends up to 30 waiting emails now. Administrators only. Does nothing until email is set up on the live site. */
export async function sendQueuedNow(): Promise<void> {
  const user = await requireRole(["admin"]);
  const result = await sendQueued(30);

  await writeAudit({
    actorId: user.id,
    action: "notifications.send_now",
    entityType: "notification",
    changes: { ...result },
  });
  revalidatePath("/admin/notifications");

  const params = new URLSearchParams({ attempted: String(result.attempted), sent: String(result.sent), failed: String(result.failed) });
  if (result.skipped) params.set("skipped", result.skipped);
  redirect(`/admin/notifications?${params.toString()}`);
}
