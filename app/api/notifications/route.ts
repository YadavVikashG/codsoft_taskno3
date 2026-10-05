import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const result = await pool.query(
    `SELECT n.id, n.kind, n.read_at AS "readAt", n.created_at AS "createdAt",
       actor.id AS "actorId", actor.name AS "actorName", actor.headline AS "actorHeadline"
     FROM notifications n
     JOIN users actor ON actor.id = n.actor_id
     WHERE n.recipient_id = $1 AND actor.disabled = FALSE
     ORDER BY n.created_at DESC LIMIT 50`,
    [user.id],
  );
  return NextResponse.json({
    notifications: result.rows,
    unreadCount: result.rows.filter((notification) => notification.readAt === null).length,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  let body: { targetId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid notification request." }, { status: 400 });
  }
  if (typeof body.targetId !== "string" || !body.targetId || body.targetId === user.id) {
    return NextResponse.json({ error: "Choose another member to notify." }, { status: 400 });
  }

  const recipient = await pool.query("SELECT id FROM users WHERE id = $1 AND disabled = FALSE", [body.targetId]);
  if (!recipient.rowCount) return NextResponse.json({ error: "This member is unavailable." }, { status: 404 });

  const result = await pool.query(
    `INSERT INTO notifications (id, recipient_id, actor_id, kind)
     VALUES ($1, $2, $3, 'profile_view')
     ON CONFLICT (recipient_id, actor_id, kind)
     DO UPDATE SET read_at = NULL, created_at = NOW()
     RETURNING id`,
    [`notification-${crypto.randomUUID()}`, body.targetId, user.id],
  );
  return NextResponse.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  let body: { id?: unknown; markAll?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid notification update." }, { status: 400 });
  }

  if (body.markAll === true) {
    await pool.query("UPDATE notifications SET read_at = NOW() WHERE recipient_id = $1 AND read_at IS NULL", [user.id]);
    return NextResponse.json({ ok: true });
  }
  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Choose a notification to mark as read." }, { status: 400 });
  }
  const result = await pool.query(
    "UPDATE notifications SET read_at = NOW() WHERE id = $1 AND recipient_id = $2 RETURNING id",
    [body.id, user.id],
  );
  if (!result.rowCount) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
