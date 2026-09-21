import { headers } from "next/headers";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";

interface AuditEntry {
  actorId?: string | null;
  action: string; // for example "auth.login", "member.update"
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, unknown>;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await getDb()
      .insert(auditLogs)
      .values({
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        changes: { ...entry.changes, ip },
      });
  } catch (error) {
    // A logging problem must never stop someone signing in
    console.error("Audit log failed", error);
  }
}
