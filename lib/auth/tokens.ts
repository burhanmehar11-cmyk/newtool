import { jwtVerify, SignJWT } from "jose";
import { SESSION_MAX_AGE_S, STATE_MAX_AGE_S } from "./constants";

/**
 * Signed, short tokens for the session cookie and the OAuth state cookie
 * (HS256 with SESSION_SECRET). The session token carries only ids; the
 * server checks the session row on every request, so it can be revoked.
 */

const ISSUER = "locentio";
const key = (secret: string) => new TextEncoder().encode(secret);

export async function signSession(p: { sid: string; uid: string }, secret: string, maxAgeS = SESSION_MAX_AGE_S) {
  return new SignJWT({ uid: p.uid })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience("session")
    .setSubject(p.sid)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeS}s`)
    .sign(key(secret));
}

export async function verifySession(token: string, secret: string): Promise<{ sid: string; uid: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER, audience: "session", algorithms: ["HS256"] });
    return typeof payload.sub === "string" && typeof payload.uid === "string" ? { sid: payload.sub, uid: payload.uid } : null;
  } catch {
    return null;
  }
}

export type OAuthState = { state: string; verifier: string; nonce: string; next: string };

export async function signState(s: OAuthState, secret: string) {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience("oauth-state")
    .setIssuedAt()
    .setExpirationTime(`${STATE_MAX_AGE_S}s`)
    .sign(key(secret));
}

export async function verifyState(token: string, secret: string): Promise<OAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER, audience: "oauth-state", algorithms: ["HS256"] });
    const { state, verifier, nonce, next } = payload as Record<string, unknown>;
    return [state, verifier, nonce, next].every((x) => typeof x === "string") ? { state, verifier, nonce, next } as OAuthState : null;
  } catch {
    return null;
  }
}
