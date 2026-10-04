import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const maxBytes = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ["application/pdf", ".pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/msword", ".doc"],
]);

function storageClient() {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: process.env.S3_ACCESS_KEY_ID
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "" }
      : undefined,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "candidate") return NextResponse.json({ error: "Candidate access required." }, { status: 403 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const formData = await request.formData();
  const file = formData.get("resume");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a resume to upload." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Upload a PDF or Word document." }, { status: 415 });
  if (file.size > maxBytes) return NextResponse.json({ error: "Resume must be 5 MB or smaller." }, { status: 413 });

  const extension = allowedTypes.get(file.type)!;
  const key = `resumes/${randomUUID()}${extension}`;
  const url = `/api/resumes?key=${encodeURIComponent(key)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const bucket = process.env.S3_BUCKET;

  if (bucket) {
    await storageClient().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: file.type }));
  } else {
    const directory = path.join(process.cwd(), "private_uploads", "resumes");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, path.basename(key)), bytes, { mode: 0o600 });
  }

  await pool.query("UPDATE users SET resume_name = $2, resume_url = $3 WHERE id = $1", [user.id, file.name.slice(0, 200), url]);
  return NextResponse.json({ url, name: file.name }, { status: 201 });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!/^resumes\/[a-f0-9-]+\.(pdf|doc|docx)$/.test(key)) return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  const url = `/api/resumes?key=${encodeURIComponent(key)}`;

  let allowed = user.role === "admin";
  if (user.role === "candidate") allowed = user.resumeUrl === url || Boolean((await pool.query("SELECT 1 FROM applications WHERE candidate_id = $1 AND resume_url = $2", [user.id, url])).rowCount);
  if (user.role === "recruiter") allowed = Boolean((await pool.query(
    `SELECT 1 FROM applications a JOIN jobs j ON j.id = a.job_id
     WHERE j.created_by = $1 AND a.resume_url = $2 LIMIT 1`,
    [user.id, url],
  )).rowCount);
  if (!allowed) return NextResponse.json({ error: "You do not have access to this resume." }, { status: 403 });

  const extension = path.extname(key);
  const contentType = extension === ".pdf" ? "application/pdf" : extension === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/msword";
  let body: BodyInit;
  if (process.env.S3_BUCKET) {
    const result = await storageClient().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    if (!result.Body) return NextResponse.json({ error: "Resume not found." }, { status: 404 });
    body = result.Body.transformToWebStream();
  } else {
    try {
      body = await readFile(path.join(process.cwd(), "private_uploads", "resumes", path.basename(key)));
    } catch {
      return NextResponse.json({ error: "Resume not found." }, { status: 404 });
    }
  }
  return new Response(body, { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="resume${extension}"`, "Cache-Control": "private, no-store" } });
}