import bcrypt from "bcryptjs";

const COST = 12;

/**
 * A valid hash of a random password nobody knows. When an email is not found we still run a
 * full comparison against this, so the response time does not reveal which emails exist.
 */
export const DUMMY_HASH = "$2b$12$dnS34Ikv5bjVi9QhPzxMlu0PWYIqzntcwkRDcWN5D30/6RKLTtXx6";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
