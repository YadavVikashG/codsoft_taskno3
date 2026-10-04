import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
const categories = new Set(["suggestion", "campaign", "report_recruiter", "other"]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  if (!pool) return NextResponse.json({ requests: [] });
  const result = await pool.query(
    `SELECT s.id, s.category, s.subject, s.message, s.recruiter_email AS "recruiterEmail",
       s.status, s.created_at AS "createdAt", u.name AS "senderName", u.email AS "senderEmail"
     FROM support_requests s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT 500`,
  );
  return NextResponse.json({ requests: result.rows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json();
  const category = String(body.category ?? "");
  const subject = String(body.subject ?? "").trim().slice(0, 160);
  const message = String(body.message ?? "").trim().slice(0, 5000);
  const recruiterEmail = String(body.recruiterEmail ?? "").trim().toLowerCase();
  if (!categories.has(category) || subject.length < 3 || message.length < 8) {
    return NextResponse.json({ error: "Choose a topic and include a subject and a little more detail." }, { status: 400 });
  }
  if (category === "report_recruiter" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recruiterEmail)) {
    return NextResponse.json({ error: "Enter the recruiter's account email so we can review your report." }, { status: 400 });
  }
  const result = await pool.query(
    `INSERT INTO support_requests (id, user_id, category, subject, message, recruiter_email)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, category, subject, status, created_at AS "createdAt"`,
    [`support-${crypto.randomUUID()}`, user.id, category, subject, message, category === "report_recruiter" ? recruiterEmail : ""],
  );
  return NextResponse.json({ request: result.rows[0] }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json();
  if (typeof body.id !== "string" || !["open", "reviewing", "resolved"].includes(body.status)) {
    return NextResponse.json({ error: "Choose a valid request status." }, { status: 400 });
  }
  const result = await pool.query(
    `UPDATE support_requests SET status = $2 WHERE id = $1
     RETURNING id, category, subject, status, created_at AS "createdAt"`,
    [body.id, body.status],
  );
  if (!result.rowCount) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  return NextResponse.json({ request: result.rows[0] });
}