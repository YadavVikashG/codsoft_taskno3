import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
const postId = () => `community-${crypto.randomUUID()}`;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!pool) return NextResponse.json({ people: [], companies: [], posts: [], followedCompanies: [], incomingRequests: [] });

  const conversationWith = new URL(request.url).searchParams.get("with");
  if (conversationWith) {
    const connection = await pool.query(
      `SELECT 1 FROM community_connections WHERE status = 'accepted'
       AND ((requester_id = $1 AND recipient_id = $2) OR (requester_id = $2 AND recipient_id = $1))`,
      [user.id, conversationWith],
    );
    if (!connection.rowCount) return NextResponse.json({ error: "Messages are available only between connected members." }, { status: 403 });
    const [messages, recipient] = await Promise.all([
      pool.query(
        `SELECT m.id, m.sender_id AS "senderId", m.recipient_id AS "recipientId", m.body, m.created_at AS "createdAt", u.name AS "senderName"
         FROM community_messages m JOIN users u ON u.id = m.sender_id
         WHERE (m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1)
         ORDER BY m.created_at ASC LIMIT 300`,
        [user.id, conversationWith],
      ),
      pool.query("SELECT id, name, headline FROM users WHERE id = $1 AND disabled = FALSE", [conversationWith]),
    ]);
    if (!recipient.rowCount) return NextResponse.json({ error: "This member is unavailable." }, { status: 404 });
    return NextResponse.json({ messages: messages.rows, person: recipient.rows[0] });
  }

  const [peopleResult, companiesResult, followsResult, requestsResult] = await Promise.all([
    pool.query(
      `SELECT u.id, u.name, u.role, u.company, u.headline, u.location,
         u.education_level AS "educationLevel", u.education_details AS "educationDetails",
         u.certificates, u.current_company AS "currentCompany", u.current_position AS "currentPosition",
            CASE WHEN u.id = $1 THEN 'self'
              WHEN outgoing.status = 'accepted' OR incoming.status = 'accepted' THEN 'friends'
              WHEN outgoing.status = 'pending' THEN 'sent'
              WHEN incoming.status = 'pending' THEN 'received'
              ELSE 'none' END AS "connectionStatus",
         CASE WHEN $2 = 'admin' THEN EXISTS (
           SELECT 1 FROM support_requests report
           WHERE report.category = 'report_recruiter' AND u.role = 'recruiter'
             AND LOWER(report.recruiter_email) = LOWER(u.email)
         ) ELSE FALSE END AS "canAdminConnect"
       FROM users u
       LEFT JOIN community_connections outgoing ON outgoing.requester_id = $1 AND outgoing.recipient_id = u.id
       LEFT JOIN community_connections incoming ON incoming.requester_id = u.id AND incoming.recipient_id = $1
      WHERE u.disabled = FALSE
       ORDER BY (u.role = 'admin') DESC, u.created_at DESC LIMIT 250`,
      [user.id, user.role],
    ),
    pool.query(
      `WITH listed_companies AS (
         SELECT NULLIF(TRIM(company), '') AS name FROM users WHERE role = 'recruiter' AND disabled = FALSE
         UNION SELECT NULLIF(TRIM(company), '') FROM jobs WHERE status = 'open'
       )
       SELECT c.name, COUNT(DISTINCT f.user_id)::int AS followers,
         EXISTS(SELECT 1 FROM community_company_follows own WHERE own.user_id = $1 AND own.company_name = c.name) AS following
       FROM listed_companies c LEFT JOIN community_company_follows f ON f.company_name = c.name
       WHERE c.name IS NOT NULL GROUP BY c.name ORDER BY c.name LIMIT 150`,
      [user.id],
    ),
    pool.query("SELECT company_name FROM community_company_follows WHERE user_id = $1", [user.id]),
    pool.query(
      `SELECT c.requester_id AS id, u.name, u.headline
       FROM community_connections c JOIN users u ON u.id = c.requester_id
       WHERE c.recipient_id = $1 AND c.status = 'pending' AND u.disabled = FALSE
       ORDER BY c.created_at DESC`,
      [user.id],
    ),
  ]);

  const postsResult = await pool.query(
     `SELECT p.id, p.content, p.image_url AS "imageUrl", p.created_at AS "createdAt", p.shared_post_id AS "sharedPostId",
       u.id AS "authorId", u.name AS "authorName", u.role AS "authorRole", u.headline AS "authorHeadline",
       original.content AS "sharedContent", original.image_url AS "sharedImageUrl", originalUser.name AS "sharedAuthorName",
       (SELECT COUNT(*)::int FROM community_post_likes l WHERE l.post_id = p.id) AS likes,
       COALESCE((
         SELECT json_agg(json_build_object('id', liker.id, 'name', liker.name, 'headline', liker.headline, 'isFriend', liker.is_friend) ORDER BY liker.created_at DESC)
         FROM (
           SELECT l.user_id AS id, u.name, u.headline, l.created_at,
             EXISTS(SELECT 1 FROM community_connections c WHERE c.status = 'accepted'
               AND ((c.requester_id = $1 AND c.recipient_id = l.user_id) OR (c.requester_id = l.user_id AND c.recipient_id = $1))) AS is_friend
           FROM community_post_likes l JOIN users u ON u.id = l.user_id
           WHERE l.post_id = p.id AND u.disabled = FALSE
         ) liker
       ), '[]'::json) AS likers,
       EXISTS(SELECT 1 FROM community_post_likes own WHERE own.post_id = p.id AND own.user_id = $1) AS liked,
       (SELECT COUNT(*)::int FROM community_post_comments c WHERE c.post_id = p.id) AS "commentCount",
       COALESCE(recent.comments, '[]'::json) AS comments
     FROM community_posts p JOIN users u ON u.id = p.author_id
     LEFT JOIN community_posts original ON original.id = p.shared_post_id
     LEFT JOIN users originalUser ON originalUser.id = original.author_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object('id', c.id, 'body', c.body, 'authorId', cu.id, 'authorName', cu.name, 'createdAt', c.created_at) ORDER BY c.created_at DESC) AS comments
       FROM (SELECT * FROM community_post_comments WHERE post_id = p.id ORDER BY created_at DESC LIMIT 3) c
       JOIN users cu ON cu.id = c.user_id
     ) recent ON TRUE
     WHERE u.disabled = FALSE ORDER BY p.created_at DESC LIMIT 60`,
    [user.id],
  );

  return NextResponse.json({
    people: peopleResult.rows,
    companies: companiesResult.rows,
    followedCompanies: followsResult.rows.map((row) => row.company_name),
    incomingRequests: requestsResult.rows,
    posts: postsResult.rows,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json();
  const action = String(body.action ?? "");

  if (action === "friend_request") {
    const targetId = String(body.targetId ?? "");
    if (!targetId || targetId === user.id) return NextResponse.json({ error: "Choose another member." }, { status: 400 });
    const target = await pool.query(
      `SELECT target.id,
        (SELECT role FROM users WHERE id = $2) AS "requesterRole",
        EXISTS (SELECT 1 FROM support_requests report
          WHERE report.category = 'report_recruiter' AND target.role = 'recruiter'
            AND LOWER(report.recruiter_email) = LOWER(target.email)) AS "hasRecruiterReport"
       FROM users target WHERE target.id = $1 AND target.disabled = FALSE`,
      [targetId, user.id],
    );
    if (!target.rowCount) return NextResponse.json({ error: "This member is unavailable." }, { status: 404 });
    if (target.rows[0].requesterRole === "admin" && !target.rows[0].hasRecruiterReport) {
      return NextResponse.json({ error: "Admin connection requests are available only for recruiters reported to CareerHub." }, { status: 403 });
    }
    if (target.rows[0].requesterRole !== "admin" && user.role === "admin" && !target.rows[0].hasRecruiterReport) {
      return NextResponse.json({ error: "You can connect with a recruiter after a report has been submitted about them." }, { status: 403 });
    }
    const existing = await pool.query(
      `SELECT status, requester_id AS "requesterId" FROM community_connections
       WHERE (requester_id = $1 AND recipient_id = $2) OR (requester_id = $2 AND recipient_id = $1) LIMIT 1`,
      [user.id, targetId],
    );
    if (existing.rows[0]?.status === "accepted") return NextResponse.json({ error: "You are already connected." }, { status: 409 });
    if (existing.rows[0]) return NextResponse.json({ error: existing.rows[0].requesterId === user.id ? "Request already sent." : "This member has already requested to connect with you." }, { status: 409 });
    await pool.query("INSERT INTO community_connections (requester_id, recipient_id) VALUES ($1, $2)", [user.id, targetId]);
    return NextResponse.json({ ok: true });
  }

  if (action === "accept_request") {
    const requesterId = String(body.targetId ?? "");
    const result = await pool.query(
      "UPDATE community_connections SET status = 'accepted' WHERE requester_id = $1 AND recipient_id = $2 AND status = 'pending' RETURNING requester_id",
      [requesterId, user.id],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Friend request not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (action === "direct_message") {
    const recipientId = String(body.targetId ?? "");
    const message = String(body.content ?? "").trim().slice(0, 2000);
    if (!recipientId || recipientId === user.id || !message) return NextResponse.json({ error: "Write a message to a connected member." }, { status: 400 });
    const result = await pool.query(
      `INSERT INTO community_messages (id, sender_id, recipient_id, body)
       SELECT $1, sender.id, recipient.id, $3 FROM users sender, users recipient
       WHERE sender.id = $2 AND sender.disabled = FALSE AND recipient.id = $4 AND recipient.disabled = FALSE
         AND EXISTS (SELECT 1 FROM community_connections c WHERE c.status = 'accepted'
           AND ((c.requester_id = $2 AND c.recipient_id = $4) OR (c.requester_id = $4 AND c.recipient_id = $2)))
       RETURNING id, sender_id AS "senderId", recipient_id AS "recipientId", body, created_at AS "createdAt"`,
      [`dm-${crypto.randomUUID()}`, user.id, message, recipientId],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Messages are available only between connected members." }, { status: 403 });
    return NextResponse.json({ message: { ...result.rows[0], senderName: user.name } }, { status: 201 });
  }

  if (action === "follow_company") {
    const company = String(body.company ?? "").trim().slice(0, 160);
    const following = Boolean(body.following);
    if (!company) return NextResponse.json({ error: "Choose a company." }, { status: 400 });
    const exists = await pool.query(
      `SELECT 1 FROM users WHERE role = 'recruiter' AND disabled = FALSE AND LOWER(TRIM(company)) = LOWER($1)
       UNION SELECT 1 FROM jobs WHERE status = 'open' AND LOWER(TRIM(company)) = LOWER($1) LIMIT 1`,
      [company],
    );
    if (!exists.rowCount) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    if (following) await pool.query("INSERT INTO community_company_follows (user_id, company_name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [user.id, company]);
    else await pool.query("DELETE FROM community_company_follows WHERE user_id = $1 AND company_name = $2", [user.id, company]);
    return NextResponse.json({ ok: true });
  }

  if (action === "create_post") {
    const content = String(body.content ?? "").trim().slice(0, 3000);
    const imageUrl = String(body.imageUrl ?? "").trim();
    if (!content && !imageUrl) return NextResponse.json({ error: "Write something or attach an image before posting." }, { status: 400 });
    if (imageUrl) {
      try {
        const image = new URL(imageUrl, "http://careerhub.local");
        const key = image.searchParams.get("key") ?? "";
        if (image.pathname !== "/api/community/media" || !/^community-images\/[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(key)) throw new Error("Invalid image URL.");
      } catch {
        return NextResponse.json({ error: "Upload a valid post image." }, { status: 400 });
      }
    }
    await pool.query("INSERT INTO community_posts (id, author_id, content, image_url) VALUES ($1, $2, $3, $4)", [postId(), user.id, content, imageUrl]);
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (action === "share_post") {
    const originalId = String(body.postId ?? "");
    const content = String(body.content ?? "").trim().slice(0, 1000);
    const original = await pool.query("SELECT id FROM community_posts WHERE id = $1", [originalId]);
    if (!original.rowCount) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    await pool.query("INSERT INTO community_posts (id, author_id, content, shared_post_id) VALUES ($1, $2, $3, $4)", [postId(), user.id, content || "Shared a post", originalId]);
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (action === "toggle_like") {
    const targetPost = String(body.postId ?? "");
    const deleted = await pool.query("DELETE FROM community_post_likes WHERE post_id = $1 AND user_id = $2 RETURNING post_id", [targetPost, user.id]);
    if (!deleted.rowCount) {
      const exists = await pool.query("SELECT 1 FROM community_posts WHERE id = $1", [targetPost]);
      if (!exists.rowCount) return NextResponse.json({ error: "Post not found." }, { status: 404 });
      await pool.query("INSERT INTO community_post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [targetPost, user.id]);
    }
    return NextResponse.json({ liked: !deleted.rowCount });
  }

  if (action === "comment") {
    const targetPost = String(body.postId ?? "");
    const comment = String(body.content ?? "").trim().slice(0, 1200);
    if (!comment) return NextResponse.json({ error: "Write a comment first." }, { status: 400 });
    const result = await pool.query(
      `INSERT INTO community_post_comments (id, post_id, user_id, body)
       SELECT $1, p.id, $2, $3 FROM community_posts p WHERE p.id = $4
       RETURNING id`,
      [`comment-${crypto.randomUUID()}`, user.id, comment, targetPost],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown community action." }, { status: 400 });
}
