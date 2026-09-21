import type { Role } from "@/modules/auth/roles";

/** Handling money: recording payments and cancelling invoices. Viewing and creating invoices is open to all staff. */
export const PAYMENT_ROLES: readonly Role[] = ["admin", "treasurer"];

export const canHandlePayments = (role: Role) => PAYMENT_ROLES.includes(role);
