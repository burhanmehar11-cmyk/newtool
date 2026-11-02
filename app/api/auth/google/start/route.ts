import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, STATE_MAX_AGE_S } from "@/lib/auth/constants";
import { buildAuthorizeUrl, callbackUrl, pkceChallenge, randomToken, resolveAppOrigin } from "@/lib/auth/oidc";
import { signState } from "@/lib/auth/tokens";
import { safeNextPath } from "@/lib/safe-redirect";
import { accountsConfigured, configuredSiteUrl, googleOAuth, sessionSecret } from "@/server/env";

/** Step 1 of "Sign in with Google": send the visitor to Google with PKCE, state and nonce. */
export async function GET(request: NextRequest) {
  if (!accountsConfigured()) return NextResponse.redirect(new URL("/sign-in?error=not_configured", request.url));

  // Always run the Google round trip on the canonical domain, so the redirect
  // URI matches the one registered in Google Cloud and the state cookie is
  // readable when Google sends the visitor back.
  const origin = resolveAppOrigin(configuredSiteUrl(), request.nextUrl.origin);
  if (origin !== request.nextUrl.origin) {
    return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, origin));
  }

  const { clientId } = googleOAuth()!;
  const verifier = randomToken(32);
  const state = randomToken(16);
  const nonce = randomToken(16);
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  const res = NextResponse.redirect(
    buildAuthorizeUrl({
      clientId,
      redirectUri: callbackUrl(origin),
      state,
      nonce,
      codeChallenge: await pkceChallenge(verifier),
    }),
  );
  res.cookies.set(STATE_COOKIE, await signState({ state, verifier, nonce, next }, sessionSecret()!), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: STATE_MAX_AGE_S,
  });
  return res;
}
