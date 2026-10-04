import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
const stages = new Set(["New", "In review", "Shortlisted", "Interview", "Offer", "Hired", "Declined"]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!pool) return NextResponse.json({ applications: [] });
  const ownership = user.role === "candidate" ? "a.candidate_id = $1" : user.role === "recruiter" ? "j.created_by = $1" : "TRUE";
  const result = await pool.query(
    `SELECT a.id, a.job_id AS "jobId", a.candidate_id AS "candidateId",
       a.candidate_name AS name, a.candidate_email AS email, a.resume_url AS "resumeUrl",
      a.cover_note AS "coverNote", a.stage, a.created_at AS date,
      a.interview_at AS "interviewAt",
      a.interview_at + INTERVAL '30 minutes' AS "meetingExpiresAt",
      (a.meeting_url <> '') AS "hasMeetingUrl",
      CASE WHEN a.interview_at <= NOW() AND a.interview_at > NOW() - INTERVAL '30 minutes'
        THEN a.meeting_url ELSE '' END AS "meetingUrl",
      j.title AS "jobTitle", j.company, j.location, j.workplace,
       COALESCE(u.headline, '') AS headline
     FROM applications a JOIN jobs j ON j.id = a.job_id
     LEFT JOIN users u ON u.id = a.candidate_id
     WHERE ${ownership} ORDER BY a.created_at DESC`,
    user.role === "admin" ? [] : [user.id],
  );
  return NextResponse.json({ applications: result.rows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "candidate") return NextResponse.json({ error: "Candidate access required." }, { status: 403 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json();
  const jobId = String(body.jobId ?? "");
  const resumeUrl = String(body.resumeUrl ?? "");
  const coverNote = String(body.coverNote ?? "").slice(0, 3000);
  if (!jobId || !resumeUrl || resumeUrl !== user.resumeUrl) {
    return NextResponse.json({ error: "Add a resume to your profile before applying." }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO applications (id, job_id, candidate_id, candidate_name, candidate_email, resume_url, cover_note)
       SELECT $1, j.id, $2, $3, $4, $5, $6 FROM jobs j WHERE j.id = $7 AND j.status = 'open'
       ON CONFLICT (job_id, candidate_email) DO NOTHING
       RETURNING id, job_id AS "jobId", candidate_id AS "candidateId", stage, created_at AS date`,
      [`application-${crypto.randomUUID()}`, user.id, user.name, user.email, resumeUrl, coverNote, jobId],
    );
    if (!result.rowCount) return NextResponse.json({ error: "This role is unavailable or you have already applied." }, { status: 409 });
    return NextResponse.json({ application: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Could not save application:", error);
    return NextResponse.json({ error: "Could not submit this application." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "recruiter" && user.role !== "admin") return NextResponse.json({ error: "Recruiter access required." }, { status: 403 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json();
  if (typeof body.id !== "string" || !stages.has(body.stage)) return NextResponse.json({ error: "Invalid pipeline stage." }, { status: 400 });
  const result = user.role === "admin"
    ? await pool.query("UPDATE applications SET stage = $2 WHERE id = $1 RETURNING id, stage", [body.id, body.stage])
    : await pool.query(
      `UPDATE applications a SET stage = $3 FROM jobs j
       WHERE a.id = $1 AND a.job_id = j.id AND j.created_by = $2 RETURNING a.id, a.stage`,
      [body.id, user.id, body.stage],
    );
  if (!result.rowCount) return NextResponse.json({ error: "Application not found in your pipeline." }, { status: 404 });
  return NextResponse.json({ application: result.rows[0] });
}