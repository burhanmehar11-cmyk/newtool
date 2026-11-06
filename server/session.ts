import "server-only";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, SESSION_IDLE_S, SESSION_MAX_AGE_S, SIGNED_IN_COOKIE } from "@/lib/auth/constants";
import { signSession } from "@/lib/auth/tokens";
import { resolveAppOrigin } from "@/lib/auth/oidc";
import { configuredSiteUrl, sessionSecret } from "@/server/env";
import { withService } from "@/server/db";
import { AUTH_SQL } from "@/server/db-sql";

/** Options for the readable signed-in hint (no secret in it; the session cookie stays httpOnly). */
export const signedInHintOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};

/** Records a session row and returns the signed cookie value. */
export async function newSessionToken(userId: string, userAgent: string | null) {
  const s = await withService((q) => q.query<{ id: string }>(AUTH_SQL.createSession, [userId, SESSION_IDLE_S, (userAgent ?? "").slice(0, 300)]));
  return signSession({ sid: s.rows[0].id, uid: userId }, sessionSecret()!);
}

/** For server actions and route handlers that use next/headers cookies. */
export async function startSession(userId: string) {
  const h = await headers();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await newSessionToken(userId, h.get("user-agent")), sessionCookieOptions);
  jar.set(SIGNED_IN_COOKIE, "1", signedInHintOptions);
}

/** The app's canonical origin, for links in emails. */
export async function appOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return resolveAppOrigin(configuredSiteUrl(), `${proto}://${host}`);
}


export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
}
