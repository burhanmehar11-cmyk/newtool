import "server-only";
import { z } from "zod";
import { buildMessage, toGmailRaw } from "@/lib/gmail/mime";
import { requireWorkspace } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withService, withUser } from "@/server/db";
import { decryptJson, encryptJson, tokenKey } from "@/server/gmail/crypto";
import { refreshAccessToken, revokeToken, sendRaw } from "@/server/gmail/google";
import { deleteSecret, getMailbox, listMailboxes, loadSecret, markMailbox, saveSecret, updateMailboxSettings, upsertMailbox } from "@/server/mailbox-store";

const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));
const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));
const uuid = z.string().uuid();

type StoredTokens = { refreshToken: string; scope: string };

/** Called from the OAuth callback after every check has passed. */
export async function connectMailbox(p: { userId: string; workspaceId: string; email: string; name: string | null; refreshToken: string; scope: string }) {
  const key = tokenKey();
  if (!key) throw new Error("no_token_key");
  const id = await asQ(p.userId, (q) => upsertMailbox(q, p.workspaceId, p.userId, p.email, p.name, p.scope));
  await svc((q) => saveSecret(q, id, encryptJson({ refreshToken: p.refreshToken, scope: p.scope } satisfies StoredTokens, key)));
  accessCache.delete(id);
  return id;
}

export async function getMailboxes() {
  const { user, workspace } = await requireWorkspace("/app/settings");
  return asQ(user.id, (q) => listMailboxes(q, workspace.id));
}

// Short-lived access tokens, kept in memory only (they last about an hour).
const accessCache = new Map<string, { token: string; expiresAt: number }>();

/** A fresh access token for a mailbox. Marks the mailbox for reconnection when Google revoked it. */
export async function accessTokenFor(accountId: string): Promise<{ ok: true; token: string } | { ok: false; message: string; reconnect: boolean }> {
  const hit = accessCache.get(accountId);
  if (hit && hit.expiresAt - 60_000 > Date.now()) return { ok: true, token: hit.token };
  const key = tokenKey();
  const blob = await svc((q) => loadSecret(q, accountId));
  const stored = blob && key ? decryptJson<StoredTokens>(blob, key) : null;
  if (!stored?.refreshToken) {
    await svc((q) => markMailbox(q, accountId, { status: "needs_reconnect", lastError: "Stored access couldn't be read. Reconnect the mailbox." }));
    return { ok: false, message: "This mailbox needs to be reconnected.", reconnect: true };
  }
  const r = await refreshAccessToken(stored.refreshToken);
  if (!r.ok) {
    if (r.revoked) await svc((q) => markMailbox(q, accountId, { status: "needs_reconnect", lastError: r.message }));
    return { ok: false, message: r.message, reconnect: r.revoked };
  }
  accessCache.set(accountId, { token: r.accessToken, expiresAt: r.expiresAt });
  return { ok: true, token: r.accessToken };
}

/**
 * Sends one test email from the mailbox to itself. Proves the connection
 * end to end without contacting anyone else.
 */
export async function sendTestEmail(accountId: string): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/settings");
  if (!uuid.safeParse(accountId).success) return { ok: false, error: "Mailbox not found." };
  const box = await asQ(user.id, (q) => getMailbox(q, accountId));
  if (!box || box.status === "disconnected") return { ok: false, error: "Mailbox not found." };

  const token = await accessTokenFor(box.id);
  if (!token.ok) return { ok: false, error: token.message };
  const raw = toGmailRaw(
    buildMessage({
      from: { email: box.email, name: box.sender_name },
      to: box.email,
      subject: "Locentio test email",
      text: `This is a test from Locentio for the workspace "${workspace.name}".\n\nIf you're reading it, Locentio can send from ${box.email}. Nothing was sent to anyone else.`,
    }),
  );
  const sent = await sendRaw(token.token, raw);
  if (!sent.ok) {
    if (sent.code === "auth") accessCache.delete(box.id);
    await asQ(user.id, (q) => markMailbox(q, box.id, { status: sent.code === "auth" || sent.code === "permission" ? "needs_reconnect" : undefined, lastError: sent.message }));
    return { ok: false, error: sent.message };
  }
  await asQ(user.id, (q) => markMailbox(q, box.id, { status: "connected", lastError: null, tested: true }));
  return { ok: true, to: box.email };
}

const settingsSchema = z.object({
  dailyCap: z.coerce.number().int().min(1, "At least 1 a day.").max(200, "At most 200 a day."),
  senderName: z.string().trim().max(80).transform((v) => v || null),
});

export async function saveMailboxSettings(accountId: string, input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/settings");
  if (!["owner", "admin"].includes(workspace.role)) return { ok: false, error: "Only workspace owners and admins can change mailboxes." };
  const parsed = settingsSchema.safeParse(input);
  if (!uuid.safeParse(accountId).success || !parsed.success) return { ok: false, error: parsed.success ? "Mailbox not found." : parsed.error.issues[0].message };
  const ok = await asQ(user.id, (q) => updateMailboxSettings(q, accountId, parsed.data));
  return ok ? { ok: true } : { ok: false, error: "Mailbox not found." };
}

/** Revokes the grant at Google, deletes the stored token, and keeps the row (campaign history) as disconnected. */
export async function disconnectMailbox(accountId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/settings");
  if (!["owner", "admin"].includes(workspace.role)) return { ok: false, error: "Only workspace owners and admins can disconnect mailboxes." };
  if (!uuid.safeParse(accountId).success) return { ok: false, error: "Mailbox not found." };
  const box = await asQ(user.id, (q) => getMailbox(q, accountId));
  if (!box) return { ok: false, error: "Mailbox not found." };
  const key = tokenKey();
  const blob = await svc((q) => loadSecret(q, box.id));
  const stored = blob && key ? decryptJson<StoredTokens>(blob, key) : null;
  if (stored?.refreshToken) await revokeToken(stored.refreshToken);
  await svc((q) => deleteSecret(q, box.id));
  await asQ(user.id, (q) => markMailbox(q, box.id, { status: "disconnected", lastError: null }));
  accessCache.delete(box.id);
  return { ok: true };
}
