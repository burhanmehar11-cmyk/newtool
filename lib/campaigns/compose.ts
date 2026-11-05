import { jwtVerify, SignJWT } from "jose";

/**
 * Final email assembly at send time. The footer (sender address and an
 * unsubscribe link) is always added by Locentio and can't be edited away.
 */

export function unsubscribeUrl(origin: string, token: string) {
  return `${origin}/unsubscribe/${token}`;
}

export function withFooter(body: string, p: { businessAddress: string; unsubscribeUrl: string }) {
  const lines = [body.trimEnd(), "", "--"];
  if (p.businessAddress.trim()) lines.push(p.businessAddress.trim());
  lines.push(`Don't want emails from me? Unsubscribe: ${p.unsubscribeUrl}`);
  return lines.join("\n");
}

/** RFC 2369 / RFC 8058 headers so mail apps can show a one-click unsubscribe. */
export function unsubscribeHeaders(oneClickUrl: string) {
  return { "List-Unsubscribe": `<${oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

const key = (secret: string) => new TextEncoder().encode(secret);

/** Signed, non-expiring token: who opted out of which workspace. Carries no secrets. */
export async function signUnsubscribe(p: { ws: string; email: string }, secret: string) {
  return new SignJWT({ ws: p.ws, em: p.email.toLowerCase() }).setProtectedHeader({ alg: "HS256" }).setIssuer("locentio").setAudience("unsubscribe").sign(key(secret));
}

export async function verifyUnsubscribe(token: string, secret: string): Promise<{ ws: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: "locentio", audience: "unsubscribe", algorithms: ["HS256"] });
    return typeof payload.ws === "string" && typeof payload.em === "string" ? { ws: payload.ws, email: payload.em } : null;
  } catch {
    return null;
  }
}

/** Is this address or its domain on the do-not-contact list? */
export function isSuppressed(email: string, entries: { value: string; kind: "email" | "domain" }[]) {
  const e = email.toLowerCase();
  const domain = e.split("@")[1] ?? "";
  return entries.some((x) => (x.kind === "email" ? x.value === e : domain === x.value || domain.endsWith(`.${x.value}`)));
}
