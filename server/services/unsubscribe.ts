import "server-only";
import { verifyUnsubscribe } from "@/lib/campaigns/compose";
import type { Q } from "@/server/auth-store";
import { addSuppression } from "@/server/campaign-store";
import { withService } from "@/server/db";
import { sessionSecret } from "@/server/env";

/** Public, no sign-in: adds the address to the workspace's do-not-contact list and stops anything queued to it. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret || token.length > 2000) return false;
  const v = await verifyUnsubscribe(token, secret);
  if (!v) return false;
  await withService((q) => addSuppression(q as unknown as Q, v.ws, null, v.email, "email", "unsubscribe"));
  return true;
}

export async function peekUnsubscribe(token: string): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret || token.length > 2000) return null;
  return (await verifyUnsubscribe(token, secret))?.email ?? null;
}
