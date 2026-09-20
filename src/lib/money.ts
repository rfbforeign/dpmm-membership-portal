const ringgit = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 2,
});

/** Formats a numeric string or number from the database as Malaysian Ringgit, e.g. "150.00" -> "RM 150.00". */
export function formatRM(value: string | number): string {
  return ringgit.format(Number(value));
}
