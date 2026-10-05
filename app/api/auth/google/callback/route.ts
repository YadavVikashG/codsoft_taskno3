import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSession, hashPassword, sessionCookie, sessionLifetimeSeconds } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

const transactionCookie = "careerhub_google_oauth";

type OAuthTransaction = {
  state: string;
  verifier: string;
  role: "candidate" | "recruiter";
  company: string;
  intent: "login" | "register";
};

function authRedirect(origin: string, error: string) {
  const response = NextResponse.redirect(new URL(`/?google_error=${encodeURIComponent(error)}`, origin));
  response.cookies.set(transactionCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!redirectUri || !clientId || !clientSecret) {
    return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 503 });
  }

  let callback: URL;
  try {
    callback = new URL(redirectUri);
    if (callback.pathname !== "/api/auth/google/callback" || (process.env.NODE_ENV === "production" && callback.protocol !== "https:")) {
      throw new Error("Invalid callback URL.");
    }
  } catch {
    return NextResponse.json({ error: "Google sign-in callback URL is invalid." }, { status: 503 });
  }

  const requestUrl = new URL(request.url);
  const clearWithError = (code: string) => authRedirect(callback.origin, code);
  if (requestUrl.searchParams.has("error")) return clearWithError("cancelled");

  const code = requestUrl.searchParams.get("code");
  const returnedState = requestUrl.searchParams.get("state");
  const transactionValue = request.headers.get("cookie")
    ?.split("; ")
    .find((part) => part.startsWith(`${transactionCookie}=`))
    ?.slice(transactionCookie.length + 1);
  if (!code || !returnedState || !transactionValue) return clearWithError("failed");

  let transaction: OAuthTransaction;
  try {
    transaction = JSON.parse(Buffer.from(decodeURIComponent(transactionValue), "base64url").toString("utf8")) as OAuthTransaction;
  } catch {
    return clearWithError("failed");
  }
  if (
    typeof transaction.state !== "string" ||
    typeof transaction.verifier !== "string" ||
    typeof transaction.company !== "string" ||
    transaction.state.length !== 43 ||
    transaction.verifier.length < 43 ||
    transaction.verifier.length > 128
  ) return clearWithError("failed");
  const expectedState = Buffer.from(transaction.state);
  const actualState = Buffer.from(returnedState);
  if (expectedState.length !== actualState.length || !timingSafeEqual(expectedState, actualState)) return clearWithError("failed");
  if (!["candidate", "recruiter"].includes(transaction.role) || !["login", "register"].includes(transaction.intent)) return clearWithError("failed");
  if (transaction.role === "recruiter" && transaction.intent === "register" && transaction.company.trim().length < 2) return clearWithError("failed");
  if (!pool) return clearWithError("failed");

  let userInfo: { sub?: string; email?: string; email_verified?: boolean; name?: string };
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: transaction.verifier,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) {
      console.error("Google OAuth token exchange failed:", tokenResponse.status);
      return clearWithError("failed");
    }
    const tokenData = await tokenResponse.json() as { access_token?: string };
    if (!tokenData.access_token) {
      console.error("Google OAuth token response did not include an access token.");
      return clearWithError("failed");
    }
    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: "no-store",
    });
    if (!userResponse.ok) {
      console.error("Google OAuth user profile request failed:", userResponse.status);
      return clearWithError("failed");
    }
    userInfo = await userResponse.json() as typeof userInfo;
  } catch (error) {
    console.error("Google OAuth request failed:", error);
    return clearWithError("failed");
  }

  const email = userInfo.email?.trim().toLowerCase();
  const name = userInfo.name?.trim().slice(0, 100);
  if (!userInfo.sub || !email || !name || userInfo.email_verified !== true) {
    console.error("Google OAuth returned an incomplete or unverified user profile.");
    return clearWithError("failed");
  }

  try {
    let result = await pool.query(
      `SELECT id, disabled FROM users WHERE email = $1`,
      [email],
    );
    let user = result.rows[0];
    if (user?.disabled) return clearWithError("unavailable");
    if (!user && transaction.intent === "login") return clearWithError("signin");

    if (!user) {
      result = await pool.query(
        `INSERT INTO users (id, name, email, password_hash, role, company)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [
          `user-${crypto.randomUUID()}`,
          name,
          email,
          await hashPassword(randomBytes(32).toString("hex")),
          transaction.role,
          transaction.role === "recruiter" ? transaction.company.trim().slice(0, 160) : "",
        ],
      );
      user = result.rows[0];
      if (!user) {
        result = await pool.query("SELECT id, disabled FROM users WHERE email = $1", [email]);
        user = result.rows[0];
        if (!user || user.disabled) return clearWithError("unavailable");
      }
    }

    const sessionToken = await createSession(user.id);
    const response = NextResponse.redirect(new URL("/", callback.origin));
    response.cookies.set(sessionCookie, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionLifetimeSeconds,
    });
    response.cookies.set(transactionCookie, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/google/callback",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("Google OAuth account sign-in failed:", error);
    return clearWithError("failed");
  }
}
