import "server-only";
import { z } from "zod";
import { brand } from "@/config/brand";
import { ANNOUNCEMENT_TEMPLATES, findTemplate, firstNameOf, renderAnnouncement } from "@/lib/announcements";
import { trialDays } from "@/lib/admin";
import { readShortUnsubscribeToken, signUpdatesUnsubscribe, verifyUpdatesUnsubscribe } from "@/lib/updates-unsubscribe";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import { emailChannel, sendEmail } from "@/server/email";
import { configuredSiteUrl, sessionSecret } from "@/server/env";
import { track } from "@/server/events";
import * as store from "@/server/announcement-store";
import { requireAdmin } from "@/server/services/admin";

/**
 * Product emails from the owner to registered users (admin panel →
 * Announcements). Plain text, personalised with the first name, Reply-To the
 * public contact address, an unsubscribe link and one-click unsubscribe
 * headers in every email. Sent in batches that can resume, so nobody gets the
 * same announcement twice.
 */

const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));
const site = () => configuredSiteUrl() ?? brand.siteUrl;
/** Sender address: ANNOUNCE_FROM, else the public contact address (hello@locenti.com). See SendOptions.from. */
const fromAddress = () => process.env.ANNOUNCE_FROM?.trim() || brand.supportEmail;

/** Who is acting: the signed-in admin (admin panel), or the owner through the admin API. */
export type Actor = { email: string | null };
const actorOr = async (actor?: Actor): Promise<Actor> => actor ?? (await requireAdmin());

const draftSchema = z.object({
  template: z.string().max(40).nullable().optional(),
  subject: z.string().trim().min(3, "Write a subject.").max(200),
  body: z.string().trim().min(20, "Write the email.").max(20000),
});

export async function getAnnouncementsData(actor?: Actor) {
  await actorOr(actor);
  const channel = await emailChannel();
  try {
    const [recipients, history, optOuts] = await svc(async (q) => [await store.countRecipients(q), await store.listAnnouncements(q), await store.optOutCount(q)] as const);
    return { ready: true as const, templates: ANNOUNCEMENT_TEMPLATES, recipients, history, optOuts, channel, from: fromAddress(), replyTo: brand.supportEmail, site: site(), trialDays: trialDays() };
  } catch {
    return { ready: false as const, templates: ANNOUNCEMENT_TEMPLATES, recipients: 0, history: [], optOuts: 0, channel, from: fromAddress(), replyTo: brand.supportEmail, site: site(), trialDays: trialDays() };
  }
}

async function composeFor(r: { email: string; name: string | null; user_id?: string | null }, subject: string, body: string) {
  const secret = sessionSecret();
  if (!secret) throw new Error("SESSION_SECRET missing");
  // No visible unsubscribe line (owner's decision): opting out works through the one-click
  // List-Unsubscribe header (the mail app's Unsubscribe button) and by replying.
  const token = await signUpdatesUnsubscribe(r.email, secret);
  const vars = { first_name: firstNameOf(r.name, r.email), site: site(), trial_days: trialDays() };
  return {
    subject: renderAnnouncement(subject, vars),
    text: renderAnnouncement(body, vars),
    opts: {
      replyTo: brand.supportEmail,
      from: fromAddress(),
      headers: { "List-Unsubscribe": `<${site()}/api/updates/unsubscribe/${token}>, <mailto:${brand.supportEmail}?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    },
  };
}

/** Sends the draft to the admin themself, exactly as recipients will get it. */
export async function sendAnnouncementTest(input: unknown, actor?: Actor): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const admin = await actorOr(actor);
  const p = draftSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  if (!admin.email) return { ok: false, error: "Your account has no email address." };
  try {
    const m = await composeFor({ email: admin.email, name: null }, `[Test] ${p.data.subject}`, p.data.body);
    await sendEmail(admin.email, m.subject, m.text, m.opts);
    return { ok: true, to: admin.email };
  } catch (e) {
    return { ok: false, error: `Couldn't send the test: ${(e as Error).message}` };
  }
}

/** Starts a send to everyone eligible. The browser then calls continueAnnouncement until it's done. */
export async function startAnnouncement(input: unknown, actor?: Actor): Promise<{ ok: true; id: string; total: number } | { ok: false; error: string }> {
  const admin = await actorOr(actor);
  const p = draftSchema.extend({ confirm: z.literal(true, { message: "Tick the box to confirm." }) }).safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  if ((await emailChannel()).kind === "none") return { ok: false, error: "Email sending isn't set up: connect your Gmail in Mailboxes (or set SMTP_URL) first." };
  try {
    const { id, total } = await svc(async (q) => ({
      id: await store.createAnnouncement(q, { template: findTemplate(p.data.template)?.id ?? null, subject: p.data.subject, body: p.data.body, createdBy: admin.email ?? "admin" }),
      total: await store.countRecipients(q),
    }));
    return { ok: true, id, total };
  } catch {
    return { ok: false, error: "Couldn't start: run the database update 0017_announcements.sql in Neon first." };
  }
}

/**
 * Sends the next batch (at most 40 emails or ~40 seconds) and says what's
 * left. Stops early if the mailbox refuses (e.g. Gmail's daily limit), so it
 * can be resumed later without repeats.
 */
export async function continueAnnouncement(id: string, actor?: Actor): Promise<{ ok: true; sent: number; failed: number; remaining: number; done: boolean; note: string | null } | { ok: false; error: string }> {
  const admin = await actorOr(actor);
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Not found." };
  const a = await svc((q) => store.getAnnouncement(q, id));
  if (!a) return { ok: false, error: "Not found." };
  if (a.status !== "sending") return { ok: true, sent: 0, failed: 0, remaining: 0, done: true, note: null };
  const started = Date.now();
  const batch = await svc((q) => store.nextRecipients(q, id, 40));
  let sent = 0;
  let failed = 0;
  let note: string | null = null;
  for (const r of batch) {
    if (Date.now() - started > 40_000) break;
    try {
      const m = await composeFor(r, a.subject, a.body);
      await sendEmail(r.email, m.subject, m.text, m.opts);
      await svc((q) => store.recordSend(q, id, r, true, null));
      sent++;
    } catch (e) {
      const msg = (e as Error).message;
      // The mailbox itself refused (limit reached, access lost): stop here and resume later; this person isn't marked.
      if (/limit|quota|rate|reconnect|access|not configured|Gmail API/i.test(msg)) {
        note = msg;
        break;
      }
      await svc((q) => store.recordSend(q, id, r, false, msg));
      failed++;
    }
  }
  const remaining = await svc((q) => store.remainingRecipients(q, id));
  const done = remaining === 0;
  if (done) {
    await svc((q) => store.finishAnnouncement(q, id, "sent"));
    const totals = (await svc((q) => store.listAnnouncements(q, 50))).find((x) => x.id === id);
    await track({ email: admin.email, kind: "announcement_sent", area: "account", outcome: totals?.failed ? "warning" : "success", summary: `Sent announcement "${a.subject}" to ${totals?.sent ?? sent} people${totals?.failed ? ` (${totals.failed} failed)` : ""}` });
  } else if (note) {
    await track({ email: admin.email, kind: "announcement_paused", area: "account", outcome: "warning", summary: `Announcement "${a.subject}" paused with ${remaining} left: ${note}` });
  }
  return { ok: true, sent, failed, remaining, done, note };
}

/** Sends the welcome email (as new users get it) to the admin, to see how it looks. */
export async function sendWelcomeTest(actor?: Actor): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const admin = await actorOr(actor);
  if (!admin.email) return { ok: false, error: "Your account has no email address." };
  try {
    const { sendWelcomePreview } = await import("@/server/services/welcome");
    await sendWelcomePreview(admin.email);
    return { ok: true, to: admin.email };
  } catch (e) {
    return { ok: false, error: `Couldn't send it: ${(e as Error).message}` };
  }
}

/** Stops a send that's under way (those already emailed stay emailed). */
export async function stopAnnouncement(id: string, actor?: Actor): Promise<{ ok: boolean }> {
  await actorOr(actor);
  if (!z.string().uuid().safeParse(id).success) return { ok: false };
  await svc((q) => store.finishAnnouncement(q, id, "stopped"));
  return { ok: true };
}

/* ------------------------------------------------------ public: unsubscribe */

export async function peekUpdatesUnsubscribe(token: string): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const userId = readShortUnsubscribeToken(token, secret);
  if (userId) return (await svc((q) => q.query<{ email: string | null }>("select lower(email) as email from auth.users where id = $1", [userId])).catch(() => null))?.rows[0]?.email ?? null;
  return verifyUpdatesUnsubscribe(token, secret);
}

export async function unsubscribeFromUpdates(token: string): Promise<boolean> {
  const email = await peekUpdatesUnsubscribe(token);
  if (!email) return false;
  try {
    await svc((q) => store.optOut(q, email));
    await track({ email, kind: "updates_unsubscribed", area: "account", outcome: "info", summary: "Unsubscribed from product emails" });
    return true;
  } catch {
    return false;
  }
}
