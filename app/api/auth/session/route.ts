import { NextResponse, type NextRequest } from "next/server";
import { isAllowedBetaEmail } from "@/lib/beta-allowlist";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, evaluateClaims, isSameOrigin } from "@/lib/session-policy";
import { accountsConfigured } from "@/server/env";
import { adminAuth } from "@/server/firebase/admin";
import { withService } from "@/server/db";

/**
 * Exchanges a fresh Firebase ID token for an httpOnly session cookie.
 * The browser keeps no Firebase session of its own (in-memory persistence).
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers.get("origin"), request.nextUrl.origin)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }
  if (!accountsConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const auth = adminAuth()!;

  let idToken: unknown;
  try {
    idToken = ((await request.json()) as { idToken?: unknown }).idToken;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof idToken !== "string" || idToken.length > 4096) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const decision = evaluateClaims(decoded, Math.floor(Date.now() / 1000));
  if (!decision.ok) return NextResponse.json({ error: decision.code }, { status: decision.status });

  // First sign-in: only allowlisted emails get an account during the private beta.
  const email = decoded.email!.toLowerCase();
  const existing = await withService((q) => q.query("select id from auth.users where firebase_uid = $1", [decoded.uid]));
  if (!existing.rows.length) {
    if (!isAllowedBetaEmail(email)) return NextResponse.json({ error: "not_invited" }, { status: 403 });
    await withService((q) =>
      q.query(
        `insert into auth.users (firebase_uid, email, raw_user_meta_data, last_sign_in_at)
         values ($1, $2, jsonb_build_object('full_name', $3::text), now())
         on conflict (firebase_uid) do nothing`,
        [decoded.uid, email, typeof decoded.name === "string" ? decoded.name.slice(0, 120) : ""],
      ),
    );
  } else {
    await withService((q) => q.query("update auth.users set last_sign_in_at = now(), email = $2 where firebase_uid = $1", [decoded.uid, email]));
  }

  const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_S * 1000 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
