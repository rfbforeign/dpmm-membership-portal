import { getSql } from "@/db";
import { requireRole } from "@/modules/auth/dal";
import { STAFF_ROLES } from "@/modules/auth/roles";

export interface DashboardMetrics {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  expiredMembers: number;
  suspendedMembers: number;
  totalRevenue: number;
  totalInvoiced: number;
  outstandingAmount: number;
  unpaidInvoices: number;
  overdueInvoices: number;
}

/** Staff only. The check lives here, next to the data, so no page can forget it. */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  await requireRole(STAFF_ROLES);

  const rows = await getSql()`SELECT * FROM dashboard_metrics`;
  const row = rows[0] ?? {};
  // Postgres returns counts and sums as strings; convert once here
  const n = (value: unknown) => Number(value ?? 0);

  return {
    totalMembers: n(row.total_members),
    activeMembers: n(row.active_members),
    pendingMembers: n(row.pending_members),
    expiredMembers: n(row.expired_members),
    suspendedMembers: n(row.suspended_members),
    totalRevenue: n(row.total_revenue),
    totalInvoiced: n(row.total_invoiced),
    outstandingAmount: n(row.outstanding_amount),
    unpaidInvoices: n(row.unpaid_invoices),
    overdueInvoices: n(row.overdue_invoices),
  };
}
