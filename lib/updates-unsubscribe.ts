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
