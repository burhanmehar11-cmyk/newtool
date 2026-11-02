"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedBetaEmail } from "@/lib/beta-allowlist";
import { SESSION_COOKIE } from "@/lib/session-policy";
import { adminAuth } from "@/server/firebase/admin";

/** Lets the sign-up form stop early for addresses without an invite. */
export async function checkInviteAction(email: string): Promise<{ allowed: boolean }> {
  const parsed = z.string().trim().email().safeParse(email);
  return { allowed: parsed.success && isAllowedBetaEmail(parsed.data) };
}

export async function signOutAction() {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  const auth = adminAuth();
  if (session && auth) {
    try {
      const decoded = await auth.verifySessionCookie(session);
      // Invalidates every session for this user, on every device.
      await auth.revokeRefreshTokens(decoded.sub);
    } catch {
      // Already invalid: clearing the cookie is enough.
    }
  }
  store.delete(SESSION_COOKIE);
  redirect("/");
}
