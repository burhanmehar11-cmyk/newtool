import "server-only";
import { isAllowedBetaEmail } from "@/lib/beta-allowlist";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import { signupOpen } from "@/server/env";
import { hasTeamAccess } from "@/server/team-store";

/**
 * Who may sign in or sign up: anyone when SIGNUP_OPEN=true (free trials);
 * otherwise emails on BETA_ALLOWED_EMAILS, plus people a workspace invited
 * (a pending invite, or membership someone gave them). Checked on every
 * sign-in, so removing someone takes effect.
 */
export async function mayUseLocenti(email: string): Promise<boolean> {
  if (signupOpen() || isAllowedBetaEmail(email)) return true;
  try {
    return await withService((q) => hasTeamAccess(q as unknown as Q, email));
  } catch {
    return false; // e.g. migration 0009 not run yet
  }
}
