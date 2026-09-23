const STYLE: Record<string, string> = {
  unpaid: "border border-accent text-accent",
  paid: "bg-primary text-cream",
  cancelled: "bg-primary-deep/70 text-cream",
};

const LABEL: Record<string, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  cancelled: "Cancelled",
};

export function InvoiceStatusBadge({ status, overdue = false }: { status: string; overdue?: boolean }) {
  const label = overdue && status === "unpaid" ? "Overdue" : LABEL[status] ?? status;
  const style = overdue && status === "unpaid" ? "bg-accent text-white" : STYLE[status] ?? "border border-primary text-primary";

  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}
