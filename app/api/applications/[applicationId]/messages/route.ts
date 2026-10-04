import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
const messageKinds = new Set(["message", "interview", "offer", "rejection"]);

async function findApplication(applicationId: string) {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT a.id, a.candidate_id AS "candidateId", a.stage,
      j.created_by AS "recruiterId", j.title AS "jobTitle", j.company,
      j.description AS "jobDescription", j.employment,
      j.salary_min AS "salaryMin", j.salary_max AS "salaryMax",
       c.name AS "candidateName", r.name AS "recruiterName"
     FROM applications a JOIN jobs j ON j.id = a.job_id
     LEFT JOIN users c ON c.id = a.candidate_id
     LEFT JOIN users r ON r.id = j.created_by
     WHERE a.id = $1`,
    [applicationId],
  );
  return result.rows[0] ?? null;
}

function canAccess(user: { id: string; role: string }, application: { candidateId: string | null; recruiterId: string | null }) {
  return user.role === "admin" || user.id === application.candidateId || user.id === application.recruiterId;
}

export async function GET(_request: Request, context: { params: Promise<{ applicationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!pool) return NextResponse.json({ messages: [] });
  const { applicationId } = await context.params;
  const application = await findApplication(applicationId);
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  if (!canAccess(user, application)) return NextResponse.json({ error: "You do not have access to this conversation." }, { status: 403 });
  const result = await pool.query(
    `SELECT m.id, m.kind, m.subject, m.body, m.scheduled_at AS "scheduledAt",
       m.scheduled_at + INTERVAL '30 minutes' AS "meetingExpiresAt",
       (m.meeting_url <> '') AS "hasMeetingUrl",
       CASE WHEN m.kind = 'interview' AND m.scheduled_at <= NOW()
         AND m.scheduled_at > NOW() - INTERVAL '30 minutes'
         THEN m.meeting_url ELSE '' END AS "meetingUrl",
       m.created_at AS "createdAt", m.sender_id AS "senderId",
       u.name AS "senderName"
     FROM application_messages m JOIN users u ON u.id = m.sender_id
     WHERE m.application_id = $1 ORDER BY m.created_at ASC`,
    [applicationId],
  );
  return NextResponse.json({ messages: result.rows, application });
}

export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "candidate" && user.role !== "recruiter" && user.role !== "admin") {
    return NextResponse.json({ error: "Messaging is not available for this account." }, { status: 403 });
  }
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const { applicationId } = await context.params;
  const application = await findApplication(applicationId);
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  if (!canAccess(user, application)) return NextResponse.json({ error: "You do not have access to this conversation." }, { status: 403 });

  const body = await request.json();
  const kind = String(body.kind ?? "message");
  const subject = String(body.subject ?? "").trim().slice(0, 160);
  const message = String(body.message ?? "").trim().slice(0, 10000);
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const meetingUrl = String(body.meetingUrl ?? "").trim().slice(0, 1000);
  if (!messageKinds.has(kind) || message.length < 2) return NextResponse.json({ error: "Write a message before sending." }, { status: 400 });
  if (kind !== "message" && user.role === "candidate") return NextResponse.json({ error: "Only the hiring team can send interview details or hiring decisions." }, { status: 403 });
  if (kind === "interview" && (!scheduledAt || Number.isNaN(scheduledAt.getTime()))) {
    return NextResponse.json({ error: "Choose a valid interview date and time." }, { status: 400 });
  }
  if (kind === "interview" && scheduledAt && scheduledAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Choose an interview time in the future." }, { status: 400 });
  }
  if (meetingUrl && !/^https:\/\//i.test(meetingUrl)) return NextResponse.json({ error: "Meeting links must start with https://." }, { status: 400 });
  const recipientId = user.role === "recruiter" ? application.candidateId : application.recruiterId;
  if (!recipientId) return NextResponse.json({ error: "The other participant is no longer available." }, { status: 409 });
  const defaults: Record<string, string> = {
    message: "A message about your application",
    interview: `Interview invitation · ${application.jobTitle}`,
    offer: `Offer of employment · ${application.jobTitle}`,
    rejection: `Application update · ${application.jobTitle}`,
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO application_messages
       (id, application_id, sender_id, recipient_id, kind, subject, body, scheduled_at, meeting_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, kind, subject, body, scheduled_at AS "scheduledAt", meeting_url AS "meetingUrl", created_at AS "createdAt"`,
      [`message-${crypto.randomUUID()}`, applicationId, user.id, recipientId, kind, subject || defaults[kind], message, scheduledAt, meetingUrl],
    );
    const nextStage = kind === "interview" ? "Interview" : kind === "offer" ? "Offer" : kind === "rejection" ? "Declined" : null;
    if (nextStage) {
      await client.query(
        "UPDATE applications SET stage = $2, interview_at = $3, meeting_url = $4 WHERE id = $1",
        [applicationId, nextStage, kind === "interview" ? scheduledAt : null, kind === "interview" ? meetingUrl : ""],
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ message: { ...inserted.rows[0], meetingUrl: "", hasMeetingUrl: Boolean(meetingUrl), meetingExpiresAt: scheduledAt ? new Date(scheduledAt.getTime() + 30 * 60 * 1000) : null, senderId: user.id, senderName: user.name }, stage: nextStage ?? application.stage }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Could not send application message:", error);
    return NextResponse.json({ error: "Could not send this message." }, { status: 500 });
  } finally {
    client.release();
  }
}