import { GOOGLE_AUTHORIZE_URL } from "./constants";

/**
 * Pure helpers for "Sign in with Google" (OAuth 2.0 authorization code flow
 * with PKCE + OpenID Connect). No framework or network code here, so they
 * can be unit-tested.
 */

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** RFC 7636 S256 code challenge. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

export function buildAuthorizeUrl(p: { clientId: string; redirectUri: string; state: string; codeChallenge: string; nonce: string }): string {
  const u = new URL(GOOGLE_AUTHORIZE_URL);
  u.searchParams.set("client_id", p.clientId);
  u.searchParams.set("redirect_uri", p.redirectUri);
  u.searchParams.set("response_type", "code");
  // Basic sign-in scopes only. They need no Google verification.
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", p.state);
  u.searchParams.set("nonce", p.nonce);
  u.searchParams.set("code_challenge", p.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("prompt", "select_account");
  return u.toString();
}

export type GoogleIdClaims = { sub?: unknown; email?: unknown; email_verified?: unknown; nonce?: unknown; name?: unknown };

export type ClaimCheck =
  | { ok: true; subject: string; email: string; name: string }
  | { ok: false; code: "nonce" | "no_email" | "email_not_verified" | "no_subject" };

/** Checks an already signature-verified Google ID token payload. */
export function checkIdTokenClaims(c: GoogleIdClaims, expectedNonce: string): ClaimCheck {
  if (typeof c.nonce !== "string" || c.nonce !== expectedNonce) return { ok: false, code: "nonce" };
  if (typeof c.sub !== "string" || !c.sub) return { ok: false, code: "no_subject" };
  if (typeof c.email !== "string" || !c.email) return { ok: false, code: "no_email" };
  if (c.email_verified !== true && c.email_verified !== "true") return { ok: false, code: "email_not_verified" };
  return { ok: true, subject: `google:${c.sub}`, email: c.email.toLowerCase(), name: typeof c.name === "string" ? c.name.slice(0, 120) : "" };
}
