import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!pool) return NextResponse.json({ profile: { ...user, educationLevel: "", educationDetails: "", certificates: [], currentCompany: "", currentPosition: "" } });
  const result = await pool.query(
    `SELECT id, name, email, role, company, headline, location,
       education_level AS "educationLevel", education_details AS "educationDetails",
       certificates, current_company AS "currentCompany", current_position AS "currentPosition",
       resume_name AS "resumeName", resume_url AS "resumeUrl"
     FROM users WHERE id = $1`,
    [user.id],
  );
  return NextResponse.json({ profile: result.rows[0] ?? user });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const headline = String(body.headline ?? "").trim().slice(0, 120);
  const location = String(body.location ?? "").trim().slice(0, 120);
  const educationLevel = String(body.educationLevel ?? "").trim().slice(0, 120);
  const educationDetails = String(body.educationDetails ?? "").trim().slice(0, 2000);
  const certificates = Array.isArray(body.certificates)
    ? body.certificates.map((item: unknown) => String(item).trim().slice(0, 160)).filter(Boolean).slice(0, 30)
    : [];
  const currentCompany = String(body.currentCompany ?? "").trim().slice(0, 120);
  const currentPosition = String(body.currentPosition ?? "").trim().slice(0, 120);
  if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "Enter a name between 2 and 100 characters." }, { status: 400 });
  const result = await pool.query(
    `UPDATE users SET name = $2, headline = $3, location = $4,
       education_level = $5, education_details = $6, certificates = $7,
       current_company = $8, current_position = $9
     WHERE id = $1 RETURNING id, name, email, role, company, headline, location,
       education_level AS "educationLevel", education_details AS "educationDetails",
       certificates, current_company AS "currentCompany", current_position AS "currentPosition",
       resume_name AS "resumeName", resume_url AS "resumeUrl"`,
    [user.id, name, headline, location, educationLevel, educationDetails, certificates, currentCompany, currentPosition],
  );
  return NextResponse.json({ profile: result.rows[0] });
}