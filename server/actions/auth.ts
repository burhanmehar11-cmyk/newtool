"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SIGNED_IN_COOKIE } from "@/lib/auth/constants";
import { getCurrentUser } from "@/server/auth";
import { withService } from "@/server/db";
import { AUTH_SQL } from "@/server/db-sql";

/** Revokes this session server-side, then clears the cookie. */
export async function signOutAction() {
  const user = await getCurrentUser();
  if (user) {
    await withService((q) => q.query(AUTH_SQL.revokeSession, [user.sessionId])).catch(() => undefined);
  }
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_COOKIE);
  redirect("/");
}
