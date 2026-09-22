"use server";

import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { safeNext } from "@/lib/safe-redirect";
import { writeAudit } from "@/modules/audit/log";
import { hashPassword, verifyPassword, DUMMY_HASH } from "./password";
import { validateNewPassword } from "./password-policy";
import { roleHome } from "./roles";
import { createSession, destroySession, getSession } from "./session";
import { requireUser } from "./dal";
import type { FormState } from "./types";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// One message for every failure, so the form never reveals whether an email has an account
const SIGN_IN_ERROR =
  "That email and password don't match, or the account is temporarily locked. Please try again.";

export async function login(_previous: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password || email.length > 254 || password.length > 200) {
    return { error: SIGN_IN_ERROR, email };
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const locked = !!user?.lockedUntil && user.lockedUntil > new Date();
  // Always run a full password check, even for unknown emails, so timing reveals nothing
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.passwordHash || !user.isActive || locked || !passwordOk) {
    if (user && user.passwordHash && user.isActive && !locked) {
      // Wrong password on a real, unlocked account: count it, and lock after too many
      const [updated] = await db
        .update(users)
        .set({ failedLoginCount: sql`${users.failedLoginCount} + 1` })
        .where(eq(users.id, user.id))
        .returning({ failedLoginCount: users.failedLoginCount });

      if (updated && updated.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
        await db
          .update(users)
          .set({ failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) })
          .where(eq(users.id, user.id));
        await writeAudit({ actorId: user.id, action: "auth.account_locked", entityType: "user", entityId: user.id });
      }
    }
    await writeAudit({
      actorId: user?.id ?? null,
      action: "auth.login_failed",
      entityType: "user",
      entityId: user?.id ?? null,
    });
    return { error: SIGN_IN_ERROR, email };
  }

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));
  await createSession(user.id);
  await writeAudit({ actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id });

  // redirect() works by throwing, so it must stay outside any try/catch
  redirect(next ?? roleHome(user.role));
}

export async function logout(): Promise<void> {
  const session = await getSession();
  await destroySession();
  if (session) {
    await writeAudit({ actorId: session.user.id, action: "auth.logout", entityType: "user", entityId: session.user.id });
  }
  redirect("/login");
}

export async function changePassword(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/admin/account");

  const current = String(formData.get("current") ?? "");
  const proposed = String(formData.get("proposed") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current || !proposed) return { error: "Please fill in every field." };
  if (proposed !== confirm) return { error: "The two new passwords don't match." };

  const problem = validateNewPassword(proposed, { email: user.email, current });
  if (problem) return { error: problem };

  const db = getDb();
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!row?.passwordHash || !(await verifyPassword(current, row.passwordHash))) {
    await writeAudit({ actorId: user.id, action: "auth.password_change_failed", entityType: "user", entityId: user.id });
    return { error: "Your current password isn't correct." };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(proposed), failedLoginCount: 0, lockedUntil: null })
    .where(eq(users.id, user.id));

  // Sign out every other device; this browser stays signed in
  const session = await getSession();
  if (session) {
    await db
      .delete(sessions)
      .where(and(eq(sessions.userId, user.id), ne(sessions.tokenHash, session.tokenHash)));
  }
  await writeAudit({ actorId: user.id, action: "auth.password_changed", entityType: "user", entityId: user.id });

  return { success: "Password updated. Any other devices have been signed out." };
}
