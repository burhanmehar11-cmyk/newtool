import "server-only";
import { track } from "@/server/events";
import { z } from "zod";
import { lookup } from "node:dns/promises";
import { buildMessage, toGmailRaw } from "@/lib/gmail/mime";
import { cleanPassword, findPreset } from "@/lib/mail/presets";
import { isPublicAddress } from "@/lib/research/net-policy";
import { sendSmtp, verifyImap, verifySmtp, type MailLogin } from "@/server/mail/client";
import { requireWorkspace } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withService, withUser } from "@/server/db";
import { decryptJson, encryptJson, tokenKey } from "@/server/gmail/crypto";
import { refreshAccessToken, revokeToken, sendRaw } from "@/server/gmail/google";
import { deleteSecret, getMailbox, listMailboxes, loadSecret, markMailbox, saveSecret, smtpSettings, updateMailboxSettings, upsertMailbox, upsertSmtpMailbox, type SmtpSettings } from "@/server/mailbox-store";

const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));
const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));
const uuid = z.string().uuid();

type StoredTokens = { refreshToken: string; scope: string };
/** App Password mailboxes store the password (encrypted, like tokens). */
type StoredPassword = { password: string };

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
  const { user, workspace } = await requireWorkspace("/app/mailboxes");
  const boxes = await asQ(user.id, (q) => listMailboxes(q, workspace.id));
  // A mailbox marked for reconnecting may be fine again (a passing Google error, or the Gmail API turned back on): check before asking.
  const flagged = boxes.filter((b) => b.status === "needs_reconnect").slice(0, 5);
  if (!flagged.length) return boxes;
  const healed = await Promise.all(flagged.map((b) => healMailbox(b.id)));
  return healed.some(Boolean) ? asQ(user.id, (q) => listMailboxes(q, workspace.id)) : boxes;
}

/**
 * For a mailbox marked "needs reconnecting": asks Google for fresh access with
 * the stored grant. If Google gives it, the grant is still good, so the
 * mailbox is marked connected again. True when it's usable.
 */
export async function healMailbox(accountId: string): Promise<boolean> {
  const box = (await svc((q) => q.query<{ status: string }>("select status from public.sending_accounts where id = $1", [accountId]))).rows[0];
  if (!box || box.status === "disconnected" || box.status === "revoked") return false;
  if (box.status === "connected") return true;
  accessCache.delete(accountId);
  const sender = await mailboxSender(accountId, { quiet: true });
  if (!sender.ok) return false;
  if (sender.provider === "smtp") {
    const cfg = await svc((q) => smtpSettings(q, accountId));
    const login = await smtpLogin(accountId);
    if (!cfg || !login || !(await verifySmtp(cfg.smtp, login)).ok) return false;
  }
  await svc((q) => markMailbox(q, accountId, { status: "connected", lastError: null }));
  const info = await mailboxInfo(accountId);
  await track({ workspaceId: info?.workspace_id, kind: "mailbox_healed", area: "mailbox", outcome: "success", summary: `Mailbox ${info?.email ?? ""} works again (rechecked, no reconnect needed)` });
  return true;
}

async function mailboxInfo(accountId: string) {
  return (await svc((q) => q.query<{ workspace_id: string; email: string; provider: string }>("select workspace_id, email, provider from public.sending_accounts where id = $1", [accountId]))).rows[0] ?? null;
}

/**
 * Marks a mailbox as needing a reconnect, records why, and tells the
 * workspace's owners and admins (once a day per mailbox).
 */
export async function flagReconnect(accountId: string, reason: string) {
  await svc((q) => markMailbox(q, accountId, { status: "needs_reconnect", lastError: reason }));
  accessCache.delete(accountId);
  const info = await mailboxInfo(accountId);
  if (!info) return;
  await track({
    workspaceId: info.workspace_id,
    kind: "mailbox_needs_reconnect",
    area: "mailbox",
    outcome: "failed",
    summary: `Mailbox ${info.email} lost access: ${reason}`,
    notify: {
      title: `Reconnect ${info.email}`,
      body:
        info.provider === "smtp"
          ? "The mailbox's password stopped working (it was changed, or the App Password was removed), so campaigns using it are paused. Update it on the Mailboxes page."
          : "Google stopped Locenti's access to this mailbox, so campaigns using it are paused. Reconnect it on the Mailboxes page with an App Password.",
      href: "/app/mailboxes",
      level: "failed",
      to: "managers",
      dedupeKey: `reconnect:${accountId}:${new Date().toISOString().slice(0, 10)}`,
    },
  });
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
    await flagReconnect(accountId, "Stored access couldn't be read. Reconnect the mailbox.");
    return { ok: false, message: "This mailbox needs to be reconnected.", reconnect: true };
  }
  const r = await refreshAccessToken(stored.refreshToken);
  if (!r.ok) {
    if (r.revoked) await flagReconnect(accountId, r.message);
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
  const { user, workspace } = await requireWorkspace("/app/mailboxes");
  if (!uuid.safeParse(accountId).success) return { ok: false, error: "Mailbox not found." };
  const box = await asQ(user.id, (q) => getMailbox(q, accountId));
  if (!box || box.status === "disconnected") return { ok: false, error: "Mailbox not found." };

  const sender = await mailboxSender(box.id);
  if (!sender.ok) {
    await track({ workspaceId: workspace.id, userId: user.id, kind: "mailbox_test_failed", area: "mailbox", outcome: "failed", summary: `Test email from ${box.email} failed: ${sender.message}` });
    return { ok: false, error: sender.message };
  }
  const rfcMessageId = `<${crypto.randomUUID()}@${box.email.split("@")[1] ?? "locenti.local"}>`;
  const message = buildMessage({
    from: { email: box.email, name: box.sender_name },
    to: box.email,
    subject: "Locenti test email",
    text: `This is a test from Locenti for the workspace "${workspace.name}".\n\nIf you're reading it, Locenti can send from ${box.email}. Nothing was sent to anyone else.`,
    headers: { "Message-ID": rfcMessageId },
  });
  const sent = await sender.send({ message, rfcMessageId, from: box.email, to: box.email });
  if (!sent.ok) {
    if (sent.code === "auth" || sent.code === "permission") await flagReconnect(box.id, sent.message);
    else await asQ(user.id, (q) => markMailbox(q, box.id, { lastError: sent.message }));
    await track({ workspaceId: workspace.id, userId: user.id, kind: "mailbox_test_failed", area: "mailbox", outcome: "failed", summary: `Test email from ${box.email} failed: ${sent.message}` });
    return { ok: false, error: sent.message };
  }
  await asQ(user.id, (q) => markMailbox(q, box.id, { status: "connected", lastError: null, tested: true }));
  await track({ workspaceId: workspace.id, userId: user.id, kind: "mailbox_test_ok", area: "mailbox", outcome: "success", summary: `Test email from ${box.email} sent` });
  return { ok: true, to: box.email };
}

const settingsSchema = z.object({
  dailyCap: z.coerce.number().int().min(1, "At least 1 a day.").max(200, "At most 200 a day."),
  senderName: z.string().trim().max(80).transform((v) => v || null),
});

export async function saveMailboxSettings(accountId: string, input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/mailboxes");
  if (!["owner", "admin"].includes(workspace.role)) return { ok: false, error: "Only workspace owners and admins can change mailboxes." };
  const parsed = settingsSchema.safeParse(input);
  if (!uuid.safeParse(accountId).success || !parsed.success) return { ok: false, error: parsed.success ? "Mailbox not found." : parsed.error.issues[0].message };
  const ok = await asQ(user.id, (q) => updateMailboxSettings(q, accountId, parsed.data));
  if (ok) await track({ workspaceId: workspace.id, userId: user.id, kind: "mailbox_settings", area: "mailbox", outcome: "info", summary: `Mailbox settings changed (daily limit ${parsed.data.dailyCap})` });
  return ok ? { ok: true } : { ok: false, error: "Mailbox not found." };
}

/** Revokes the grant at Google, deletes the stored token, and keeps the row (campaign history) as disconnected. */
export async function disconnectMailbox(accountId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/mailboxes");
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
  await track({ workspaceId: workspace.id, userId: user.id, kind: "mailbox_disconnected", area: "mailbox", outcome: "info", summary: `Disconnected mailbox ${box.email}` });
  return { ok: true };
}

/* ------------------------------------------------- App Password mailboxes */

/** Sending one message through whichever connection the mailbox uses. */
export type MailboxSend = (m: { message: string; rfcMessageId: string; from: string; to: string; threadId?: string }) => Promise<
  { ok: true; id: string; threadId: string } | { ok: false; code: "auth" | "permission" | "api_disabled" | "rate_limited" | "rejected" | "network"; message: string }
>;

async function smtpLogin(accountId: string): Promise<MailLogin | null> {
  const key = tokenKey();
  const blob = await svc((q) => loadSecret(q, accountId));
  const stored = blob && key ? decryptJson<StoredPassword>(blob, key) : null;
  const cfg = await svc((q) => smtpSettings(q, accountId));
  return stored?.password && cfg ? { user: cfg.username, pass: stored.password } : null;
}

/**
 * How to send from a mailbox: SMTP with its App Password, or (older
 * mailboxes) the Gmail API. Fails with `reconnect` when the mailbox's access
 * is gone and someone has to fix it.
 */
export async function mailboxSender(accountId: string, opts: { quiet?: boolean } = {}): Promise<{ ok: true; provider: "smtp" | "gmail"; send: MailboxSend } | { ok: false; message: string; reconnect: boolean }> {
  const cfg = await svc((q) => smtpSettings(q, accountId));
  if (cfg?.provider === "smtp") {
    const login = await smtpLogin(accountId);
    if (!login) {
      if (!opts.quiet) await flagReconnect(accountId, "The saved password couldn't be read. Enter it again.");
      return { ok: false, message: "This mailbox's password needs to be entered again.", reconnect: true };
    }
    return {
      ok: true,
      provider: "smtp",
      send: async (m) => {
        const r = await sendSmtp(cfg.smtp, login, { from: m.from, to: m.to, raw: m.message });
        // With SMTP our own Message-ID identifies the email, and the first one identifies the conversation.
        return r.ok ? { ok: true, id: m.rfcMessageId.toLowerCase(), threadId: m.threadId ?? m.rfcMessageId.toLowerCase() } : r;
      },
    };
  }
  const token = await accessTokenFor(accountId);
  if (!token.ok) return token;
  return { ok: true, provider: "gmail", send: (m) => sendRaw(token.token, toGmailRaw(m.message), m.threadId) };
}

const MAIL_PORTS = { smtp: [25, 465, 587, 2525], imap: [143, 993] };
const host = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{3,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Enter a server name like mail.example.com.");
const server = z.object({ host, port: z.coerce.number().int(), secure: z.boolean() });
const connectSchema = z.object({
  preset: z.enum(["google", "zoho", "hostinger", "custom"]),
  email: z.string().trim().toLowerCase().email("Enter the full email address."),
  senderName: z.string().trim().max(80).optional().default(""),
  password: z.string().min(1, "Enter the password.").max(300),
  username: z.string().trim().max(254).optional(),
  smtp: server.optional(),
  imap: server.nullable().optional(),
});

/** The servers to use: the provider's, or the ones typed in for "custom". Only public mail servers on mail ports. */
async function resolveConnection(input: unknown): Promise<{ ok: true; email: string; senderName: string | null; password: string; settings: SmtpSettings } | { ok: false; error: string }> {
  const p = connectSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const d = p.data;
  const preset = findPreset(d.preset);
  const smtp = preset.smtp ?? d.smtp;
  const imap = preset.imap ?? d.imap ?? null;
  if (!smtp) return { ok: false, error: "Enter the SMTP server (for sending)." };
  if (!MAIL_PORTS.smtp.includes(smtp.port)) return { ok: false, error: "The SMTP port is usually 465 (SSL) or 587 (STARTTLS)." };
  if (imap && !MAIL_PORTS.imap.includes(imap.port)) return { ok: false, error: "The IMAP port is usually 993 (SSL) or 143." };
  // Our own presets are known public mail servers; check only servers people type in.
  for (const h of preset.smtp ? [] : ([smtp.host, imap?.host].filter(Boolean) as string[])) {
    const addrs = await lookup(h, { all: true }).catch(() => []);
    if (!addrs.length) return { ok: false, error: `Couldn't find the server ${h}. Check the spelling.` };
    if (!addrs.every((a) => isPublicAddress(a.address))) return { ok: false, error: `${h} isn't a public mail server.` };
  }
  return {
    ok: true,
    email: d.email,
    senderName: d.senderName || null,
    password: cleanPassword(d.preset, d.password),
    settings: { preset: d.preset, smtp, imap, username: d.username?.trim() || d.email },
  };
}

// Connection tests per person, so the form can't be used to guess passwords.
const tests = new Map<string, number[]>();
function testAllowed(userId: string) {
  const now = Date.now();
  const list = (tests.get(userId) ?? []).filter((t) => now - t < 10 * 60_000);
  if (list.length >= 15) return false;
  list.push(now);
  tests.set(userId, list);
  return true;
}

type TestResult = { ok: true; imap: { ok: true } | { ok: false; message: string } } | { ok: false; error: string };

async function check(settings: SmtpSettings, login: MailLogin): Promise<TestResult> {
  const [smtp, imap] = await Promise.all([verifySmtp(settings.smtp, login), settings.imap ? verifyImap(settings.imap, login) : Promise.resolve(null)]);
  if (!smtp.ok) return { ok: false, error: smtp.message };
  return { ok: true, imap: imap ? (imap.ok ? { ok: true } : { ok: false, message: imap.message }) : { ok: false, message: "No IMAP server given, so replies can't be tracked." } };
}

/** "Test connection": logs in to SMTP and IMAP without saving or sending anything. */
export async function testMailboxConnection(input: unknown): Promise<TestResult> {
  const { user, workspace } = await requireWorkspace("/app/mailboxes");
  if (!["owner", "admin"].includes(workspace.role)) return { ok: false, error: "Only workspace owners and admins can connect mailboxes." };
  if (!testAllowed(user.id)) return { ok: false, error: "That's a lot of tries. Wait a few minutes, then try again." };
  const c = await resolveConnection(input);
  if (!c.ok) return c;
  return check(c.settings, { user: c.settings.username, pass: c.password });
}

/**
 * "Add mailbox" (also used to update a password): checks the login, then
 * saves the mailbox with its password encrypted. Sending needs SMTP to work;
 * reply tracking is on when IMAP works too.
 */
export async function addSmtpMailbox(input: unknown): Promise<{ ok: true; id: string; email: string; replies: boolean; note: string | null } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/mailboxes");
  if (!["owner", "admin"].includes(workspace.role)) return { ok: false, error: "Only workspace owners and admins can connect mailboxes." };
  if (!testAllowed(user.id)) return { ok: false, error: "That's a lot of tries. Wait a few minutes, then try again." };
  const key = tokenKey();
  if (!key) return { ok: false, error: "The server can't store passwords safely yet (SESSION_SECRET is missing)." };
  const c = await resolveConnection(input);
  if (!c.ok) return c;
  const login = { user: c.settings.username, pass: c.password };
  const r = await check(c.settings, login);
  if (!r.ok) {
    await track({ workspaceId: workspace.id, userId: user.id, kind: "mailbox_connect_failed", area: "mailbox", outcome: "failed", summary: `Couldn't connect ${c.email}: ${r.error}` });
    return { ok: false, error: r.error };
  }
  const settings = { ...c.settings, imap: r.imap.ok ? c.settings.imap : null };
  try {
    const id = await asQ(user.id, (q) => upsertSmtpMailbox(q, workspace.id, user.id, { email: c.email, senderName: c.senderName, ...settings }));
    await svc((q) => saveSecret(q, id, encryptJson({ password: c.password } satisfies StoredPassword, key)));
    accessCache.delete(id);
    await track({
      workspaceId: workspace.id,
      userId: user.id,
      kind: "mailbox_connected",
      area: "mailbox",
      outcome: "success",
      summary: `Connected ${c.email} (${findPreset(c.settings.preset).label}${settings.imap ? ", reply tracking on" : ", sending only"})`,
    });
    return { ok: true, id, email: c.email, replies: !!settings.imap, note: r.imap.ok ? null : r.imap.message };
  } catch (e) {
    const msg = (e as Error).message;
    return { ok: false, error: /smtp_host|preset|provider_check|login_username/.test(msg) ? "The database needs the update 0022_smtp_mailboxes.sql (run it in Neon), then try again." : "Couldn't save the mailbox. Try again." };
  }
}

