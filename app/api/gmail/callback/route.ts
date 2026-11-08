import { NextResponse, type NextRequest } from "next/server";
import { track } from "@/server/events";
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
  let who: { userId: string; workspaceId: string } | null = null;
  const REASONS: Record<string, string> = {
    not_configured: "Gmail connection isn't set up on the server",
    cancelled: "they cancelled on Google's screen",
    google: "Google returned an error",
    state: "the sign-in round trip expired or didn't match",
    exchange: "Google didn't return access",
    token: "Google's answer couldn't be verified",
    no_send_permission: "the send permission wasn't granted",
    no_refresh_token: "Google didn't give lasting access",
    server: "saving the mailbox failed",
  };
  const done = async (q: string) => {
    const err = /^mailbox_error=(\w+)/.exec(q)?.[1];
    if (err) await track({ ...(who ?? {}), kind: "mailbox_connect_failed", area: "mailbox", outcome: err === "cancelled" ? "warning" : "failed", summary: `Connecting a Gmail mailbox failed: ${REASONS[err] ?? err}` });
    const res = NextResponse.redirect(new URL(`/app/mailboxes?${q}`, request.url));
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
  who = { userId: user.id, workspaceId: ws.id };

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
  await track({
    ...who,
    kind: "mailbox_connected",
    area: "mailbox",
    outcome: "success",
    summary: `Connected Gmail mailbox ${email}${tokens.scope?.includes("gmail.readonly") ? " (with reply tracking)" : ""}`,
    notify: { title: "Mailbox connected", body: `${email} can now send your approved campaigns.`, href: "/app/mailboxes", level: "success" },
  });
  return done(`mailbox=connected&email=${encodeURIComponent(email)}`);
}
