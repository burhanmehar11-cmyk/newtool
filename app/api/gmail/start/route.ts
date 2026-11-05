import { NextResponse, type NextRequest } from "next/server";
import { STATE_MAX_AGE_S } from "@/lib/auth/constants";
import { pkceChallenge, randomToken, resolveAppOrigin } from "@/lib/auth/oidc";
import { signState } from "@/lib/auth/tokens";
import { buildGmailAuthorizeUrl, gmailCallbackUrl, GMAIL_STATE_COOKIE } from "@/lib/gmail/oauth";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { accountsConfigured, configuredSiteUrl, googleOAuth, sessionSecret } from "@/server/env";
import { tokenKey } from "@/server/gmail/crypto";

/** Step 1 of "Connect Gmail": signed-in owners/admins are sent to Google's consent screen for the send permission. */
export async function GET(request: NextRequest) {
  const back = (code: string) => NextResponse.redirect(new URL(`/app/settings?mailbox_error=${code}#mailboxes`, request.url));
  if (!accountsConfigured() || !tokenKey()) return back("not_configured");

  const origin = resolveAppOrigin(configuredSiteUrl(), request.nextUrl.origin);
  if (origin !== request.nextUrl.origin) return NextResponse.redirect(new URL(request.nextUrl.pathname, origin));

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in?next=/app/settings", request.url));
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.redirect(new URL("/app/onboarding", request.url));
  if (!["owner", "admin"].includes(ws.role)) return back("not_allowed");

  const verifier = randomToken(32);
  const state = randomToken(16);
  const nonce = randomToken(16);
  const res = NextResponse.redirect(
    buildGmailAuthorizeUrl({ clientId: googleOAuth()!.clientId, redirectUri: gmailCallbackUrl(origin), state, nonce, codeChallenge: await pkceChallenge(verifier), loginHint: user.email }),
  );
  // Bind the round trip to this user and workspace.
  res.cookies.set(GMAIL_STATE_COOKIE, await signState({ state, verifier, nonce, next: `${user.id}:${ws.id}` }, sessionSecret()!), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/gmail",
    maxAge: STATE_MAX_AGE_S,
  });
  return res;
}
