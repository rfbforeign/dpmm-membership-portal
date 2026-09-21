import { createHash, timingSafeEqual } from "node:crypto";

/**
 * True only when the request carries `Authorization: Bearer <CRON_SECRET>`.
 * Vercel adds this header to its scheduled calls when CRON_SECRET is set.
 * Both sides are hashed first so the comparison takes the same time whatever is sent.
 */
export function isAuthorizedCron(header: string | null, secret: string | undefined): boolean {
  if (!header || !secret) return false;
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const given = createHash("sha256").update(header).digest();
  return timingSafeEqual(expected, given);
}
