import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const [accounts, jobs, applications] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE role = 'candidate')::int AS candidates,
      COUNT(*) FILTER (WHERE role = 'recruiter')::int AS recruiters, COUNT(*) FILTER (WHERE role = 'admin')::int AS admins,
      COUNT(*) FILTER (WHERE disabled)::int AS disabled FROM users`),
    pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'open')::int AS open FROM jobs"),
    pool.query("SELECT COUNT(*)::int AS total FROM applications"),
  ]);
  return NextResponse.json({ accounts: accounts.rows[0], jobs: jobs.rows[0], applications: applications.rows[0] });
}