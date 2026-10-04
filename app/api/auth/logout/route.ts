import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashToken, sessionCookie } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie)?.value;
  if (token && pool) await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  const response = NextResponse.json({ success: true });
  response.cookies.set(sessionCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}