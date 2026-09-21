/** "800101-01-5555" becomes "******-**-5555". Shows only the last four digits. */
export function maskIc(ic: string | null | undefined): string | null {
  if (!ic) return null;
  const digits = ic.replace(/\D/g, "");
  if (digits.length < 4) return "*".repeat(ic.length);
  return `******-**-${digits.slice(-4)}`;
}
