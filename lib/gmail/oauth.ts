import { GOOGLE_AUTHORIZE_URL } from "@/lib/auth/constants";

/**
 * "Connect Gmail": a separate Google consent, asked only when someone
 * connects a mailbox (not at sign-in). Requests the narrowest scope that can
 * send mail: gmail.send can send as the user but can't read their inbox.
 * Reply sync (M2 step 6) will need a read scope and its own consent.
 */

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_CALLBACK_PATH = "/api/gmail/callback";
export const GMAIL_STATE_COOKIE = "locentio_gmail";

export function buildGmailAuthorizeUrl(p: { clientId: string; redirectUri: string; state: string; nonce: string; codeChallenge: string; loginHint?: string | null }) {
  const u = new URL(GOOGLE_AUTHORIZE_URL);
  u.searchParams.set("client_id", p.clientId);
  u.searchParams.set("redirect_uri", p.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", `openid email ${GMAIL_SEND_SCOPE}`);
  // A refresh token lets scheduled sends run while the user is away.
  u.searchParams.set("access_type", "offline");
  // Always show consent, so Google returns a refresh token every time.
  u.searchParams.set("prompt", "consent select_account");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", p.state);
  u.searchParams.set("nonce", p.nonce);
  u.searchParams.set("code_challenge", p.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  if (p.loginHint) u.searchParams.set("login_hint", p.loginHint);
  return u.toString();
}

/** Google lets people untick individual permissions, so check what was actually granted. */
export function hasSendScope(scope: string | null | undefined) {
  return (scope ?? "").split(/\s+/).includes(GMAIL_SEND_SCOPE);
}

export function gmailCallbackUrl(origin: string) {
  return `${origin}${GMAIL_CALLBACK_PATH}`;
}
