const STYLE = {
  paid: "bg-primary text-cream",
  unpaid: "border border-primary text-primary",
  overdue: "bg-accent text-white",
  cancelled: "bg-primary-deep/60 text-cream line-through",
} as const;

const LABEL = { paid: "Paid", unpaid: "Unpaid", overdue: "Overdue", cancelled: "Cancelled" } as const;

export function InvoiceStatusBadge({ status, overdue }: { status: string; overdue: boolean }) {
  const key = (status === "unpaid" && overdue ? "overdue" : status) as keyof typeof STYLE;
  const style = STYLE[key] ?? STYLE.unpaid;
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {LABEL[key] ?? status}
    </span>
  );
}
