import type { Role } from "@/modules/auth/roles";

/** Can change member records. The treasurer is read-only for now. */
export const MEMBER_WRITE_ROLES: readonly Role[] = ["admin", "secretariat"];

/** Can see full IC numbers. Everyone else sees them masked. */
export const IC_VIEW_ROLES: readonly Role[] = ["admin", "secretariat"];

export const canEditMembers = (role: Role) => MEMBER_WRITE_ROLES.includes(role);
export const canViewFullIc = (role: Role) => IC_VIEW_ROLES.includes(role);
