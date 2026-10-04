import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { AuthUser } from "@/lib/types";

const scrypt = promisify(nodeScrypt);
export const sessionCookie = "careerhub_session";
export const sessionLifetimeSeconds = 60 * 60 * 24 * 14;

export type { AuthUser, UserRole } from "@/lib/types";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(userId: string) {
  if (!pool) throw new Error("DATABASE_URL is required for accounts.");
  const token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '14 days')",
    [hashToken(token), userId],
  );
  return token;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!pool) return null;
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const result = await pool.query(
     `SELECT u.id, u.name, u.email, u.role, u.company, u.headline, u.location,
       u.resume_name AS "resumeName", u.resume_url AS "resumeUrl"
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.disabled = FALSE`,
    [hashToken(token)],
  );
  return (result.rows[0] as AuthUser | undefined) ?? null;
}

export function publicUser(user: AuthUser) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, company: user.company, headline: user.headline, location: user.location, resumeName: user.resumeName, resumeUrl: user.resumeUrl };
}