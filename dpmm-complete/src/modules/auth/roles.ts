export const ROLES = ["member", "secretariat", "treasurer", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Roles allowed into the /admin area. */
export const STAFF_ROLES: readonly Role[] = ["admin", "secretariat", "treasurer"];

export const ROLE_LABEL: Record<Role, string> = {
  member: "Member",
  secretariat: "Secretariat",
  treasurer: "Treasurer",
  admin: "Administrator",
};

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

/** Where a signed-in user of this role belongs. */
export function roleHome(role: Role): string {
  return isStaff(role) ? "/admin" : "/portal";
}
