/**
 * Validates the ?next= value used to send people back after signing in.
 * Accepts only paths on this site ("/admin/members"), never full URLs or "//evil.com".
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  return value;
}
