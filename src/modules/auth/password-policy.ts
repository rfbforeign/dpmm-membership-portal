/**
 * Rules for a NEW password. Returns a message to show the person, or null when it is acceptable.
 * Length matters more than symbols, so a long phrase is welcome.
 */
export const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores anything past 72 bytes

const COMMON = new Set([
  "password1234",
  "password12345",
  "123456789012",
  "1234567890123",
  "qwertyuiop12",
  "iloveyou1234",
  "administrator",
  "welcome12345",
]);

export function validateNewPassword(
  password: string,
  context: { email: string; current?: string }
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters. A short phrase of several words works well.`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return "That password is too long. Keep it under 72 characters.";
  }
  if (/^(.)\1+$/.test(password)) {
    return "Choose something less repetitive.";
  }
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) {
    return "That password is too common. Choose something less guessable.";
  }
  const localPart = context.email.split("@")[0]?.toLowerCase() ?? "";
  if (localPart.length >= 4 && lower.includes(localPart)) {
    return "Your password should not contain your email name.";
  }
  if (context.current) {
    const current = context.current.toLowerCase();
    if (lower === current || (current.length >= 4 && lower.includes(current))) {
      return "Choose a password that is different from your current one.";
    }
  }
  return null;
}
