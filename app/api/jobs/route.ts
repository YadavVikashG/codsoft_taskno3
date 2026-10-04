import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!pool) return NextResponse.json({ jobs: [], source: "unavailable" }, { status: 503 });
  const user = await getCurrentUser();
  const ownership = user?.role === "recruiter" ? "created_by = $1" : user?.role === "admin" ? "TRUE" : "status = 'open'";
  const values = user?.role === "recruiter" ? [user.id] : [];

  try {
    const result = await pool.query(
      `SELECT id, title, company, location, workplace, employment,
       salary_min AS "salaryMin", salary_max AS "salaryMax", description, tags,
      posted_at AS "postedAt", status FROM jobs WHERE ${ownership} ORDER BY posted_at DESC`,
          values,
    );
    return NextResponse.json({ jobs: result.rows, source: "postgres" });
  } catch (error) {
    console.error("Could not load jobs from PostgreSQL:", error);
    return NextResponse.json({ error: "Job listings are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "recruiter" && user.role !== "admin") return NextResponse.json({ error: "Recruiter access required." }, { status: 403 });
  if (!pool) {
    return NextResponse.json({ error: "Configure DATABASE_URL to publish a job." }, { status: 503 });
  }

  const body = await request.json();
  const required = ["title", "location", "workplace", "description"];
  if (required.some((field) => typeof body[field] !== "string" || !body[field].trim())) {
    return NextResponse.json({ error: "Complete all required job details." }, { status: 400 });
  }
  if (!["Remote", "Hybrid", "On-site"].includes(body.workplace)) return NextResponse.json({ error: "Choose a valid workplace type." }, { status: 400 });
  const company = user.role === "recruiter" ? user.company : String(body.company ?? "").trim();
  if (!company) return NextResponse.json({ error: "Add a company name to your account." }, { status: 400 });

  const id = `job-${crypto.randomUUID()}`;
  const salaryMin = Math.max(0, Number(body.salaryMin) || 0);
  const salaryMax = Math.max(salaryMin, Number(body.salaryMax) || 0);
  const tags = Array.isArray(body.tags) ? body.tags.filter((tag: unknown) => typeof tag === "string") : [];

  try {
    const result = await pool.query(
      `INSERT INTO jobs (id, title, company, location, workplace, employment, salary_min, salary_max, description, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, title, company, location, workplace, employment,
       salary_min AS "salaryMin", salary_max AS "salaryMax", description, tags`,
      [id, body.title.trim(), company, body.location.trim(), body.workplace, body.employment || "Full-time", salaryMin, salaryMax, body.description.trim(), tags, user.id],
    );
    return NextResponse.json({ job: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Could not publish job:", error);
    return NextResponse.json({ error: "Could not publish this job." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "recruiter" && user.role !== "admin") return NextResponse.json({ error: "Recruiter access required." }, { status: 403 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json();
  if (typeof body.id !== "string" || !["open", "closed"].includes(body.status)) return NextResponse.json({ error: "Choose an opening and valid status." }, { status: 400 });
  const result = user.role === "admin"
    ? await pool.query("UPDATE jobs SET status = $2 WHERE id = $1 RETURNING id, status", [body.id, body.status])
    : await pool.query("UPDATE jobs SET status = $3 WHERE id = $1 AND created_by = $2 RETURNING id, status", [body.id, user.id, body.status]);
  if (!result.rowCount) return NextResponse.json({ error: "Opening not found in your workspace." }, { status: 404 });
  return NextResponse.json({ job: result.rows[0] });
}