import bcrypt from "bcryptjs";

/** Cost factor 12 — bcryptjs default guidance for 2024+ hardware;
 *  reviewed periodically, not tied to any other constant in this app. */
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
