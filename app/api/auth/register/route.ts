import { NextResponse } from "next/server";
import { createSession, hashPassword, publicUser, sessionCookie, sessionLifetimeSeconds } from "@/lib/auth";
import { pool } from "@/lib/db";
import { UserRole } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!pool) return NextResponse.json({ error: "Accounts require DATABASE_URL." }, { status: 503 });
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = body.role as UserRole;
  const company = String(body.company ?? "").trim();
  if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a name and valid email address." }, { status: 400 });
  }
  if (password.length < 10 || password.length > 200) {
    return NextResponse.json({ error: "Use a password between 10 and 200 characters." }, { status: 400 });
  }
  if (role !== "candidate" && role !== "recruiter") {
    return NextResponse.json({ error: "Choose a candidate or recruiter account." }, { status: 400 });
  }
  if (role === "recruiter" && company.length < 2) {
    return NextResponse.json({ error: "Enter your company name." }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, company)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, company, headline, location,
         resume_name AS "resumeName", resume_url AS "resumeUrl"`,
      [`user-${crypto.randomUUID()}`, name, email, await hashPassword(password), role, role === "recruiter" ? company : ""],
    );
    const user = result.rows[0];
    const token = await createSession(user.id);
    const response = NextResponse.json({ user: publicUser(user) }, { status: 201 });
    response.cookies.set(sessionCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: sessionLifetimeSeconds });
    return response;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    console.error("Account registration failed:", error);
    return NextResponse.json({ error: "Could not create your account." }, { status: 500 });
  }
}