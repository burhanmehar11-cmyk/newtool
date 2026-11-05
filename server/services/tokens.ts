import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { requireWorkspace } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withUser } from "@/server/db";
import { insertToken, listTokens, revokeToken } from "@/server/token-store";

const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));

export async function getMyTokens() {
  const { user, workspace } = await requireWorkspace("/app/settings");
  return asQ(user.id, (q) => listTokens(q, workspace.id));
}

/** Creates a token and returns it once. Only its SHA-256 hash is stored. */
export async function createMyToken(name: unknown): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/settings");
  const n = z.string().trim().min(1, "Name the token, e.g. “Claude on my laptop”.").max(60).safeParse(name);
  if (!n.success) return { ok: false, error: n.error.issues[0].message };
  const token = `loc_${randomBytes(32).toString("base64url")}`;
  await asQ(user.id, (q) => insertToken(q, workspace.id, user.id, n.data, createHash("sha256").update(token).digest("hex"), token.slice(0, 12)));
  return { ok: true, token };
}

export async function revokeMyToken(id: string): Promise<boolean> {
  const { user } = await requireWorkspace("/app/settings");
  if (!z.string().uuid().safeParse(id).success) return false;
  return asQ(user.id, (q) => revokeToken(q, id));
}
