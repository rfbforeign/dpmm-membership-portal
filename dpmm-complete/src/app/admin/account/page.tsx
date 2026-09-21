import type { Metadata } from "next";
import { requireRole } from "@/modules/auth/dal";
import { ROLE_LABEL, STAFF_ROLES } from "@/modules/auth/roles";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireRole(STAFF_ROLES, "/admin/account");

  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight text-primary">Account</h1>

      <dl className="mt-6 max-w-md rounded-md border border-line bg-paper">
        <div className="flex justify-between border-b border-line px-5 py-3.5">
          <dt>Email</dt>
          <dd className="font-semibold text-primary">{user.email}</dd>
        </div>
        <div className="flex justify-between px-5 py-3.5">
          <dt>Role</dt>
          <dd className="font-semibold text-primary">{ROLE_LABEL[user.role]}</dd>
        </div>
      </dl>

      <h2 className="mt-12 font-display text-xl font-semibold text-primary">Change password</h2>
      <ChangePasswordForm />
    </>
  );
}
