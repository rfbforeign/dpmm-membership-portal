import { createHash, randomBytes } from "node:crypto";

/** A new random session token for the cookie: 256 bits from the system's secure random source. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What is stored in the database. A leaked database therefore cannot be used to sign in. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
