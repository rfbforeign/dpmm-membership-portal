import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import type { Role } from "./roles";
import { generateToken, hashToken } from "./token";

export const SESSION_COOKIE = "dpmm_session";
const SESSION_HOURS = 12;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

/** Signs the person in on this browser. Call only from a Server Action or Route Handler. */
export async function createSession(userId: string): Promise<void> {
  const db = getDb();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;

  // Tidy up this person's old, expired sessions while we are here
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt, userAgent });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable by page scripts
    secure: process.env.NODE_ENV === "production", // HTTPS only on the live site
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * The current session, checked against the database on every request.
 * Returns null when signed out, expired, or when the account has been deactivated.
 */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const [row] = await getDb()
    .select({
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      userId: users.id,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row || !row.isActive) return null;

  const user: SessionUser = { id: row.userId, email: row.email, name: row.name, role: row.role };
  return { user, tokenHash };
});

/** Signs the person out on this browser. Call only from a Server Action or Route Handler. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}
