import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
const roles = new Set(["candidate", "recruiter", "admin"]);

async function adminOnly() {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  if (user.role !== "admin") return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const access = await adminOnly();
  if (access.response) return access.response;
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const result = await pool.query(
    `SELECT id, name, email, role, company, disabled, created_at AS "createdAt"
     FROM users ORDER BY created_at DESC LIMIT 500`,
  );
  return NextResponse.json({ users: result.rows });
}

export async function PATCH(request: Request) {
  const access = await adminOnly();
  if (access.response) return access.response;
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json();
  const id = String(body.id ?? "");
  const role = body.role;
  const disabled = body.disabled;
  if (!id || (role !== undefined && !roles.has(role)) || (disabled !== undefined && typeof disabled !== "boolean")) {
    return NextResponse.json({ error: "Invalid account update." }, { status: 400 });
  }
  if (id === access.user?.id && (role !== undefined && role !== "admin" || disabled === true)) {
    return NextResponse.json({ error: "You cannot remove your own administrator access." }, { status: 400 });
  }
  const result = await pool.query(
    `UPDATE users SET role = COALESCE($2, role), disabled = COALESCE($3, disabled)
     WHERE id = $1 RETURNING id, name, email, role, company, disabled, created_at AS "createdAt"`,
    [id, role ?? null, disabled ?? null],
  );
  if (!result.rowCount) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  return NextResponse.json({ user: result.rows[0] });
}