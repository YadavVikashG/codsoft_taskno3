import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { UserRole } from "@/lib/types";

export const runtime = "nodejs";

const transactionCookie = "careerhub_google_oauth";
const transactionLifetimeSeconds = 60 * 10;

type OAuthIntent = "login" | "register";

export async function POST(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !redirectUri) {
    return NextResponse.json({ error: "Google sign-in is not configured. Add the Google OAuth environment variables." }, { status: 503 });
  }

  let body: { role?: unknown; company?: unknown; intent?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid Google sign-in request." }, { status: 400 });
  }

  const role = body.role as UserRole;
  const company = String(body.company ?? "").trim().slice(0, 160);
  const intent = body.intent as OAuthIntent;
  if ((role !== "candidate" && role !== "recruiter") || (intent !== "login" && intent !== "register")) {
    return NextResponse.json({ error: "Choose a valid account type." }, { status: 400 });
  }
  if (intent === "register" && role === "recruiter" && company.length < 2) {
    return NextResponse.json({ error: "Enter your company name before continuing with Google." }, { status: 400 });
  }

  let callbackUrl: URL;
  try {
    callbackUrl = new URL(redirectUri);
    if (callbackUrl.pathname !== "/api/auth/google/callback" || !["http:", "https:"].includes(callbackUrl.protocol)) {
      throw new Error("Invalid callback URL.");
    }
    if (process.env.NODE_ENV === "production" && callbackUrl.protocol !== "https:") {
      throw new Error("Google OAuth callback must use HTTPS in production.");
    }
  } catch {
    return NextResponse.json({ error: "Google sign-in callback URL is invalid." }, { status: 503 });
  }

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const transaction = Buffer.from(JSON.stringify({ state, verifier, role, company, intent })).toString("base64url");
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const response = NextResponse.json({ url: authorizationUrl.toString() });
  response.cookies.set(transactionCookie, transaction, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google/callback",
    maxAge: transactionLifetimeSeconds,
  });
  return response;
}
