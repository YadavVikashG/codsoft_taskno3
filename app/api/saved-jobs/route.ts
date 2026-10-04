import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function candidate() {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  if (user.role !== "candidate") return { response: NextResponse.json({ error: "Candidate access required." }, { status: 403 }) };
  if (!pool) return { response: NextResponse.json({ error: "Database unavailable." }, { status: 503 }) };
  return { user };
}

export async function GET() {
  const access = await candidate();
  if (access.response) return access.response;
  const result = await pool!.query("SELECT job_id AS id FROM saved_jobs WHERE user_id = $1 ORDER BY created_at DESC", [access.user!.id]);
  return NextResponse.json({ savedIds: result.rows.map((row) => row.id) });
}

export async function POST(request: Request) {
  const access = await candidate();
  if (access.response) return access.response;
  const { jobId } = await request.json();
  if (typeof jobId !== "string") return NextResponse.json({ error: "A job is required." }, { status: 400 });
  const result = await pool!.query(
    `INSERT INTO saved_jobs (user_id, job_id) SELECT $1, id FROM jobs WHERE id = $2 AND status = 'open'
     ON CONFLICT (user_id, job_id) DO NOTHING RETURNING job_id AS id`,
    [access.user!.id, jobId],
  );
  if (!result.rowCount) {
    const exists = await pool!.query("SELECT 1 FROM saved_jobs WHERE user_id = $1 AND job_id = $2", [access.user!.id, jobId]);
    if (!exists.rowCount) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const access = await candidate();
  if (access.response) return access.response;
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "A job is required." }, { status: 400 });
  await pool!.query("DELETE FROM saved_jobs WHERE user_id = $1 AND job_id = $2", [access.user!.id, jobId]);
  return NextResponse.json({ success: true });
}