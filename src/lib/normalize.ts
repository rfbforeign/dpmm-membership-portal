/** Field cleaners for the member forms. Same rules the Excel import used. */

/** Trims, collapses whitespace, and turns empty text into null. */
export function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/** Malaysian phone number to +60 format, or null when it cannot be read. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("60")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return /^\d{8,10}$/.test(digits) ? `+60${digits}` : null;
}

/** Accepts 12 digits or 000000-00-0000 and returns the dashed form; null for anything else. */
export function normalizeIc(raw: string): string | null {
  const text = raw.trim();
  if (/^\d{12}$/.test(text)) return `${text.slice(0, 6)}-${text.slice(6, 8)}-${text.slice(8)}`;
  if (/^\d{6}-\d{2}-\d{4}$/.test(text)) return text;
  return null;
}

/** Strict YYYY-MM-DD check that also rejects impossible dates like 2026-02-31. */
export function isValidIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

/** Escapes % _ and \\ so a search term is matched literally inside ILIKE. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}

/** Today's date in Malaysia (UTC+8) as YYYY-MM-DD. Using UTC would be a day behind until 8am. */
export function todayInMalaysia(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
