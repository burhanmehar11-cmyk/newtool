import "server-only";
import { GOOGLE_TOKEN_URL } from "@/lib/auth/constants";
import { gmailOAuth } from "@/server/env";

/**
 * Google token and Gmail API calls (server-side only).
 *   Token:  POST https://oauth2.googleapis.com/token
 *   Send:   POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send  { raw }
 *   Revoke: POST https://oauth2.googleapis.com/revoke
 */

const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; id_token?: string; error?: string };

export async function exchangeCode(code: string, verifier: string, redirectUri: string): Promise<TokenResponse | null> {
  const cfg = gmailOAuth();
  if (!cfg) return null;
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: verifier }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as TokenResponse | null;
}

export type Refreshed = { ok: true; accessToken: string; expiresAt: number } | { ok: false; revoked: boolean; message: string };

/** invalid_grant means the user revoked access or the token expired: the mailbox must be reconnected. */
export async function refreshAccessToken(refreshToken: string): Promise<Refreshed> {
  const cfg = gmailOAuth();
  if (!cfg) return { ok: false, revoked: false, message: "The Gmail OAuth client isn't configured on this server." };
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { ok: false, revoked: false, message: "Couldn't reach Google." };
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (res.ok && json.access_token) return { ok: true, accessToken: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  if (json.error === "invalid_grant") return { ok: false, revoked: true, message: "Google says this mailbox's access was removed or expired. Reconnect it." };
  return { ok: false, revoked: false, message: `Google couldn't refresh access (HTTP ${res.status}).` };
}

export type SendResult = { ok: true; id: string; threadId: string } | { ok: false; code: "auth" | "permission" | "rate_limited" | "rejected" | "network"; message: string };

/** Sends a raw RFC 5322 message. With threadId, Gmail files it in that thread (follow-ups). */
export async function sendRaw(accessToken: string, raw: string, threadId?: string): Promise<SendResult> {
  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { ok: false, code: "network", message: "Couldn't reach Gmail. The email wasn't sent." };
  const json = (await res.json().catch(() => ({}))) as { id?: string; threadId?: string; error?: { message?: string } };
  if (res.ok && json.id) return { ok: true, id: json.id, threadId: json.threadId ?? json.id };
  if (res.status === 401) return { ok: false, code: "auth", message: "Gmail rejected the mailbox's access. Reconnect it." };
  if (res.status === 403) return { ok: false, code: "permission", message: `Gmail refused to send (${json.error?.message ?? "permission denied"}). Check that the Gmail API is enabled and the send permission was granted.` };
  if (res.status === 429) return { ok: false, code: "rate_limited", message: "Gmail's sending limit was reached. Try again later." };
  return { ok: false, code: "rejected", message: `Gmail didn't accept the email (HTTP ${res.status}${json.error?.message ? `: ${json.error.message}` : ""}).` };
}

/** Best effort: tells Google to drop the grant when a mailbox is disconnected. */
export async function revokeToken(token: string) {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
}

const THREAD_URL = "https://gmail.googleapis.com/gmail/v1/users/me/threads/";

export type ThreadResult = { ok: true; messages: import("@/lib/replies/gmail-thread").GmailMessage[] } | { ok: false; code: "auth" | "permission" | "not_found" | "rate_limited" | "network" | "error"; message: string };

/** users.threads.get (format=full). Needs the gmail.readonly scope. */
export async function getThread(accessToken: string, threadId: string): Promise<ThreadResult> {
  if (!/^[a-f0-9]{8,40}$/i.test(threadId)) return { ok: false, code: "not_found", message: "Not a Gmail thread id." };
  const res = await fetch(`${THREAD_URL}${threadId}?format=full`, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000), cache: "no-store" }).catch(() => null);
  if (!res) return { ok: false, code: "network", message: "Couldn't reach Gmail." };
  if (res.status === 401) return { ok: false, code: "auth", message: "Gmail rejected the mailbox's access. Reconnect it." };
  if (res.status === 403) return { ok: false, code: "permission", message: "Reply tracking isn't allowed for this mailbox. Turn it on again on the Mailboxes page." };
  if (res.status === 404) return { ok: false, code: "not_found", message: "Thread not found (it may have been deleted)." };
  if (res.status === 429) return { ok: false, code: "rate_limited", message: "Gmail asked to slow down. Try again later." };
  if (!res.ok) return { ok: false, code: "error", message: `Gmail returned an error (HTTP ${res.status}).` };
  const json = (await res.json().catch(() => ({}))) as { messages?: import("@/lib/replies/gmail-thread").GmailMessage[] };
  return { ok: true, messages: json.messages ?? [] };
}
