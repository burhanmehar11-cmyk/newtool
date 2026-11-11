import { createHmac, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

/** Signed, non-expiring link to stop product emails (announcements) for one address. */
const key = (secret: string) => new TextEncoder().encode(secret);

export async function signUpdatesUnsubscribe(email: string, secret: string) {
  return new SignJWT({ em: email.toLowerCase() }).setProtectedHeader({ alg: "HS256" }).setIssuer("locentio").setAudience("updates-unsubscribe").sign(key(secret));
}

export async function verifyUpdatesUnsubscribe(token: string, secret: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: "locentio", audience: "updates-unsubscribe", algorithms: ["HS256"] });
    return typeof payload.em === "string" ? payload.em : null;
  } catch {
    return null;
  }
}

/**
 * Short form for the visible link (locenti.com/u/…): the account's id (22
 * characters) and an 11-character signature. 33 characters instead of a long
 * token; the id is looked up to find the email address.
 */
export function shortUnsubscribeToken(userId: string, secret: string): string {
  const id = Buffer.from(userId.replace(/-/g, ""), "hex").toString("base64url");
  return id + shortSig(userId, secret);
}

/** The account id in a short token, if its signature checks out. */
export function readShortUnsubscribeToken(token: string, secret: string): string | null {
  if (!/^[A-Za-z0-9_-]{33}$/.test(token)) return null;
  const hex = Buffer.from(token.slice(0, 22), "base64url").toString("hex");
  if (hex.length !== 32) return null;
  const userId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const given = Buffer.from(token.slice(22));
  const expected = Buffer.from(shortSig(userId, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}

function shortSig(userId: string, secret: string) {
  return createHmac("sha256", secret).update(`updates-unsubscribe:${userId.toLowerCase()}`).digest("base64url").slice(0, 11);
}
