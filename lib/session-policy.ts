/**
 * Pure rules for exchanging a Firebase ID token for a session cookie.
 * Kept separate so they can be unit-tested without Firebase.
 */
export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 5; // 5 days
export const MAX_AUTH_AGE_S = 5 * 60; // the sign-in must have just happened

export type TokenClaims = {
  auth_time: number;
  email?: string;
  email_verified?: boolean;
  firebase: { sign_in_provider: string };
};

export type SessionDecision = { ok: true } | { ok: false; status: 401 | 403; code: "stale_sign_in" | "no_email" | "email_not_verified" };

export function evaluateClaims(c: TokenClaims, nowS: number): SessionDecision {
  if (nowS - c.auth_time > MAX_AUTH_AGE_S) return { ok: false, status: 401, code: "stale_sign_in" };
  if (!c.email) return { ok: false, status: 403, code: "no_email" };
  if (!c.email_verified) return { ok: false, status: 403, code: "email_not_verified" };
  return { ok: true };
}

/** CSRF protection for the session endpoint: the request must come from this origin. */
export function isSameOrigin(originHeader: string | null, requestOrigin: string): boolean {
  if (!originHeader) return false;
  try {
    return new URL(originHeader).origin === new URL(requestOrigin).origin;
  } catch {
    return false;
  }
}
