import { NextResponse } from "next/server";
import { createSession, publicUser, sessionCookie, sessionLifetimeSeconds, verifyPassword } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!pool) return NextResponse.json({ error: "Accounts require DATABASE_URL." }, { status: 503 });
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const result = await pool.query(
     `SELECT id, name, email, role, company, headline, location,
       resume_name AS "resumeName", resume_url AS "resumeUrl", password_hash AS "passwordHash"
     FROM users WHERE email = $1 AND disabled = FALSE`,
    [email],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  const token = await createSession(user.id);
  const response = NextResponse.json({ user: publicUser(user) });
  response.cookies.set(sessionCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: sessionLifetimeSeconds });
  return response;
}