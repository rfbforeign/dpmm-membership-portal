/** Date maths on YYYY-MM-DD strings. Uses UTC internally so time zones never shift a date. */

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** The last day of a membership that starts on `iso` and runs `years` years: 2026-09-21 gives 2027-09-20. */
export function periodEnd(iso: string, years = 1): string {
  const [y, m, d] = iso.split("-").map(Number);
  // 29 Feb plus a year rolls to 1 Mar in a non-leap year; taking a day off then gives 28 Feb, which is right
  return addDays(toIso(new Date(Date.UTC(y + years, m - 1, d))), -1);
}

/**
 * The membership period a renewal should cover by default.
 * Still current: continue the day after it ends. Lapsed or new: start today.
 */
export function suggestPeriod(expiryDate: string | null, today: string, years = 1): { start: string; end: string } {
  const start = expiryDate && expiryDate >= today ? addDays(expiryDate, 1) : today;
  return { start, end: periodEnd(start, years) };
}
