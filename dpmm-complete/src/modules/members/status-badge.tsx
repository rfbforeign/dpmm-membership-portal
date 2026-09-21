import type { MemberStatus } from "./validation";

const STYLE: Record<MemberStatus, string> = {
  active: "bg-primary text-cream",
  pending: "border border-primary text-primary",
  expired: "bg-accent text-white",
  suspended: "bg-primary-deep/70 text-cream",
};

const LABEL: Record<MemberStatus, string> = {
  active: "Active",
  pending: "Pending",
  expired: "Expired",
  suspended: "Suspended",
};

export function StatusBadge({ status }: { status: MemberStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLE[status]}`}>
      {LABEL[status]}
    </span>
  );
}

export const STATUS_LABEL = LABEL;
