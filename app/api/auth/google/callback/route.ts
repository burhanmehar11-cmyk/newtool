import { NextResponse, type NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { GOOGLE_ISSUERS, GOOGLE_JWKS_URL, GOOGLE_TOKEN_URL, SESSION_COOKIE, SIGNUP_SOURCE_COOKIE, STATE_COOKIE } from "@/lib/auth/constants";
import { parseAttribution } from "@/lib/attribution";
import { recordAttribution } from "@/server/attribution-store";
import { callbackUrl, checkIdTokenClaims, resolveAppOrigin } from "@/lib/auth/oidc";
import { verifyState } from "@/lib/auth/tokens";
import { mayUseLocenti } from "@/server/access";
import { accountsConfigured, configuredSiteUrl, googleOAuth, sessionSecret } from "@/server/env";
import { withService } from "@/server/db";
import { googleSignIn, type Q } from "@/server/auth-store";
import { newSessionToken, sessionCookieOptions } from "@/server/session";

const googleKeys = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

/** Step 2 of "Sign in with Google": verify everything, then issue our own revocable session. */
export async function GET(request: NextRequest) {
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/sign-in?error=${code}`, request.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
  res.cookies.delete({ name: SIGNUP_SOURCE_COOKIE, path: "/api/auth/google" });
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
      // Must be byte-for-byte the redirect URI sent in the start step.
      redirect_uri: callbackUrl(resolveAppOrigin(configuredSiteUrl(), request.nextUrl.origin)),
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

  // Invite-only: listed or team-invited emails may sign in (checked on every sign-in, so removal takes effect).
  if (!(await mayUseLocenti(claims.email))) return fail("not_invited");

  let token: string;
  try {
    const userId = await withService((q) => googleSignIn(q as unknown as Q, claims.subject, claims.email, claims.name));
    const src = parseAttribution(request.cookies.get(SIGNUP_SOURCE_COOKIE)?.value ?? null);
    if (src) await withService((q) => recordAttribution(q as unknown as Q, userId, src)).catch(() => undefined);
    token = await newSessionToken(userId, request.headers.get("user-agent"));
  } catch {
    return fail("server");
  }

  const res = NextResponse.redirect(new URL(saved.next, request.url));
  res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
  res.cookies.delete({ name: SIGNUP_SOURCE_COOKIE, path: "/api/auth/google" });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
