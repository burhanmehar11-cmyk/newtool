import { NextResponse, type NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { GOOGLE_ISSUERS, GOOGLE_JWKS_URL, GOOGLE_TOKEN_URL, SESSION_COOKIE, SESSION_MAX_AGE_S, STATE_COOKIE } from "@/lib/auth/constants";
import { checkIdTokenClaims } from "@/lib/auth/oidc";
import { signSession, verifyState } from "@/lib/auth/tokens";
import { isAllowedBetaEmail } from "@/lib/beta-allowlist";
import { accountsConfigured, googleOAuth, sessionSecret } from "@/server/env";
import { withService } from "@/server/db";
import { AUTH_SQL } from "@/server/db-sql";

const googleKeys = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

/** Step 2 of "Sign in with Google": verify everything, then issue our own revocable session. */
export async function GET(request: NextRequest) {
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/sign-in?error=${code}`, request.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
    return res;
  };
  if (!accountsConfigured()) return fail("not_configured");
  const { clientId, clientSecret } = googleOAuth()!;
  const secret = sessionSecret()!;
  const params = request.nextUrl.searchParams;

  if (params.get("error")) return fail(params.get("error") === "access_denied" ? "cancelled" : "google");
  const saved = await verifyState(request.cookies.get(STATE_COOKIE)?.value ?? "", secret);
  const code = params.get("code");
  if (!saved || !code || params.get("state") !== saved.state) return fail("state");

  // Exchange the code (with the PKCE verifier) for tokens, server to server.
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${request.nextUrl.origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
      code_verifier: saved.verifier,
    }),
  }).catch(() => null);
  if (!tokenRes?.ok) return fail("exchange");
  const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string };
  if (!idToken) return fail("exchange");

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, googleKeys, { issuer: GOOGLE_ISSUERS, audience: clientId }));
  } catch {
    return fail("token");
  }
  const claims = checkIdTokenClaims(payload, saved.nonce);
  if (!claims.ok) return fail(claims.code);

  // Private beta: only listed emails may sign in (checked on every sign-in, so removal takes effect).
  if (!isAllowedBetaEmail(claims.email)) return fail("not_invited");

  const { userId, sessionId } = await withService(async (q) => {
    const u = await q.query<{ id: string }>(AUTH_SQL.upsertUser, [claims.subject, claims.email, claims.name]);
    const s = await q.query<{ id: string }>(AUTH_SQL.createSession, [u.rows[0].id, SESSION_MAX_AGE_S, (request.headers.get("user-agent") ?? "").slice(0, 300)]);
    return { userId: u.rows[0].id, sessionId: s.rows[0].id };
  });

  const res = NextResponse.redirect(new URL(saved.next, request.url));
  res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
  res.cookies.set(SESSION_COOKIE, await signSession({ sid: sessionId, uid: userId }, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
