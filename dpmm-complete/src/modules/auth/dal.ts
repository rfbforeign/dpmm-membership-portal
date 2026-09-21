import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./session";
import { roleHome, type Role } from "./roles";

/** The signed-in user, or null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  return (await getSession())?.user ?? null;
});

/** Sends signed-out visitors to the sign-in page. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  return user;
}

/**
 * Requires one of the given roles. Signed-out visitors go to sign-in; signed-in people
 * without permission go to their own home page.
 *
 * Call this in every page AND every data function that returns member data. Layouts do not
 * re-run on every navigation, so a check in a layout alone is not enough.
 */
export async function requireRole(allowed: readonly Role[], nextPath?: string): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!allowed.includes(user.role)) {
    redirect(roleHome(user.role));
  }
  return user;
}
