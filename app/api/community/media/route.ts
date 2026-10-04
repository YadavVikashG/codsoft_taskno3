import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
const maxBytes = 5 * 1024 * 1024;
const imageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
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

function matchesImageSignature(type: string, bytes: Buffer) {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/gif") return bytes.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/) !== null;
  return type === "image/webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const formData = await request.formData();
  const file = formData.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!imageTypes.has(file.type)) return NextResponse.json({ error: "Choose a JPEG, PNG, WebP, or GIF image." }, { status: 415 });
  if (file.size > maxBytes) return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!matchesImageSignature(file.type, bytes)) return NextResponse.json({ error: "This file does not match its image type." }, { status: 415 });
  const extension = imageTypes.get(file.type)!;
  const key = `community-images/${randomUUID()}${extension}`;
  const url = `/api/community/media?key=${encodeURIComponent(key)}`;

  if (process.env.S3_BUCKET) {
    await storageClient().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: bytes, ContentType: file.type, CacheControl: "private, max-age=3600" }));
  } else {
    const directory = path.join(process.cwd(), "private_uploads", "community_images");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, path.basename(key)), bytes, { mode: 0o600 });
  }

  return NextResponse.json({ url }, { status: 201 });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!pool) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!/^community-images\/[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(key)) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  const url = `/api/community/media?key=${encodeURIComponent(key)}`;
  const referenced = await pool.query("SELECT 1 FROM community_posts WHERE image_url = $1 OR id IN (SELECT shared_post_id FROM community_posts WHERE image_url = $1) LIMIT 1", [url]);
  if (!referenced.rowCount) return NextResponse.json({ error: "Image not found." }, { status: 404 });

  const extension = path.extname(key);
  const contentType = extension === ".jpg" ? "image/jpeg" : `image/${extension.slice(1)}`;
  let body: BodyInit;
  if (process.env.S3_BUCKET) {
    const result = await storageClient().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    if (!result.Body) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    body = result.Body.transformToWebStream();
  } else {
    try {
      body = await readFile(path.join(process.cwd(), "private_uploads", "community_images", path.basename(key)));
    } catch {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }
  }

  return new Response(body, { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
