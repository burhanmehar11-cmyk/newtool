import { NextResponse, type NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { GOOGLE_ISSUERS, GOOGLE_JWKS_URL } from "@/lib/auth/constants";
import { resolveAppOrigin } from "@/lib/auth/oidc";
import { verifyState } from "@/lib/auth/tokens";
import { gmailCallbackUrl, GMAIL_STATE_COOKIE, hasSendScope } from "@/lib/gmail/oauth";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { accountsConfigured, configuredSiteUrl, gmailOAuth, sessionSecret } from "@/server/env";
import { exchangeCode } from "@/server/gmail/google";
import { connectMailbox } from "@/server/services/mailboxes";

const googleKeys = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

/** Step 2 of "Connect Gmail": verify the round trip, check the send permission was granted, store the encrypted refresh token. */
export async function GET(request: NextRequest) {
  const done = (q: string) => {
    const res = NextResponse.redirect(new URL(`/app/settings?${q}#mailboxes`, request.url));
    res.cookies.delete({ name: GMAIL_STATE_COOKIE, path: "/api/gmail" });
    return res;
  };
  if (!accountsConfigured()) return done("mailbox_error=not_configured");
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return done(`mailbox_error=${params.get("error") === "access_denied" ? "cancelled" : "google"}`);

  const saved = await verifyState(request.cookies.get(GMAIL_STATE_COOKIE)?.value ?? "", sessionSecret()!);
  const code = params.get("code");
  if (!saved || !code || params.get("state") !== saved.state) return done("mailbox_error=state");
  const [uid, wsId] = saved.next.split(":");
  const user = await getCurrentUser();
  const ws = await getActiveWorkspace();
  if (!user || user.id !== uid || !ws || ws.id !== wsId || !["owner", "admin"].includes(ws.role)) return done("mailbox_error=state");

  const tokens = await exchangeCode(code, saved.verifier, gmailCallbackUrl(resolveAppOrigin(configuredSiteUrl(), request.nextUrl.origin)));
  if (!tokens?.id_token) return done("mailbox_error=exchange");
  let payload;
  try {
    ({ payload } = await jwtVerify(tokens.id_token, googleKeys, { issuer: GOOGLE_ISSUERS, audience: gmailOAuth()!.clientId }));
  } catch {
    return done("mailbox_error=token");
  }
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  if (payload.nonce !== saved.nonce || !email || (payload.email_verified !== true && payload.email_verified !== "true")) return done("mailbox_error=token");
  if (!hasSendScope(tokens.scope)) return done("mailbox_error=no_send_permission");
  if (!tokens.refresh_token) return done("mailbox_error=no_refresh_token");

  try {
    await connectMailbox({ userId: user.id, workspaceId: ws.id, email, name: typeof payload.name === "string" ? payload.name : null, refreshToken: tokens.refresh_token, scope: tokens.scope ?? "" });
  } catch {
    return done("mailbox_error=server");
  }
  return done(`mailbox=connected&email=${encodeURIComponent(email)}`);
}
