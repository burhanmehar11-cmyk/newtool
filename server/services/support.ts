import "server-only";
import { z } from "zod";
import { brand } from "@/config/brand";
import { adminTimeZone, trialDays } from "@/lib/admin";
import { allAdminEmails } from "@/server/admin-access";
import { requireUser, requireWorkspace, getActiveWorkspace } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withService, withUser } from "@/server/db";
import { sendEmail } from "@/server/email";
import { configuredSiteUrl } from "@/server/env";
import { notifyWorkspace, track } from "@/server/events";
import * as store from "@/server/support-store";
import { requireAdmin } from "@/server/services/admin";
import { firstNameOf } from "@/lib/announcements";

/** Who is acting in the admin functions: the signed-in admin, or the owner through the admin API. */
export type SupportActor = { email: string | null };
const adminOr = async (actor?: SupportActor) => actor ?? (await requireAdmin());

/**
 * Support: people open requests in the app and follow the conversation; the
 * owner answers from Admin → Support. A new request or reply emails the
 * owner; an answer notifies the person in the app and by email.
 */

const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));
const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));
const site = () => configuredSiteUrl() ?? brand.siteUrl;
const from = () => process.env.ANNOUNCE_FROM?.trim() || brand.supportEmail;
/** Reply target: requests waiting on us longer than this are flagged. */
export function supportSlaHours(v = process.env.SUPPORT_SLA_HOURS) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 720 ? n : 24;
}
const TOPIC_LABEL: Record<store.SupportTopic, string> = { account: "Account", billing: "Billing & plan", search: "Search & leads", mailbox: "Mailbox", campaigns: "Campaigns", bug: "Something's broken", feature: "Feature idea", other: "Other" };
export const SUPPORT_TOPIC_OPTIONS = store.SUPPORT_TOPICS.map((t) => ({ id: t, label: TOPIC_LABEL[t] }));

const uuid = z.string().uuid();
const body = z.string().trim().min(2, "Write a message.").max(10000, "That's too long (10,000 characters at most).");

/** Tells the owner(s) by email; never blocks the person's action. */
async function alertAdmins(subject: string, text: string) {
  for (const to of await allAdminEmails()) await sendEmail(to, subject, text, { from: from(), replyTo: brand.supportEmail }).catch(() => undefined);
}

/* ------------------------------------------------------------------- people */

export async function getMySupport() {
  const user = await requireUser("/app/support");
  try {
    return { ready: true, tickets: await asQ(user.id, (q) => store.myTickets(q)) };
  } catch {
    return { ready: false, tickets: [] };
  }
}

export async function getMyTicketDetail(id: string) {
  const user = await requireUser(`/app/support/${id}`);
  if (!uuid.safeParse(id).success) return null;
  return asQ(user.id, (q) => store.getMyTicket(q, id)).catch(() => null);
}

const openSchema = z.object({
  subject: z.string().trim().min(3, "Add a short subject.").max(200),
  topic: z.enum(store.SUPPORT_TOPICS),
  urgent: z.boolean().optional(),
  body,
});

export async function openSupportRequest(input: unknown): Promise<{ ok: true; id: string; ref: string } | { ok: false; error: string }> {
  const user = await requireUser("/app/support");
  const p = openSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  if (!user.email) return { ok: false, error: "Your account has no email address." };
  const ws = await getActiveWorkspace().catch(() => null);
  let id: string;
  try {
    id = await asQ(user.id, (q) => store.openTicket(q, { workspaceId: ws?.id ?? null, email: user.email!, subject: p.data.subject, topic: p.data.topic, priority: p.data.urgent ? "urgent" : "normal", body: p.data.body }));
  } catch {
    return { ok: false, error: "Support isn't available just yet. Email us at " + brand.supportEmail + " instead." };
  }
  const created = await asQ(user.id, (q) => store.getMyTicket(q, id)).catch(() => null);
  const ref = created ? store.ticketRef(created.ticket) : store.ticketRef({ id, number: null });
  await track({ userId: user.id, workspaceId: ws?.id, kind: "support_opened", area: "account", outcome: "info", summary: `Opened support request ${ref}: "${p.data.subject}"${p.data.urgent ? " (urgent)" : ""}` });
  // Confirmation to the person, with their ticket number.
  await sendEmail(
    user.email,
    `We've received your request [${ref}]`,
    `Hi ${firstNameOf(null, user.email)},

Thanks for reaching out. We've received your request and someone from our team will get back to you soon, usually within a day.

Ticket: ${ref}
Subject: ${p.data.subject}

Want to add details or a screenshot? Reply to this email or open your request here:
${site()}/app/support/${id}

Happy Sending,
The Locenti Team`,
    { from: from(), replyTo: brand.supportEmail },
  ).catch(() => undefined);
  await alertAdmins(
    `[${ref}${p.data.urgent ? ", urgent" : ""}] ${p.data.subject}`,
    `${user.email} opened ${ref} (${TOPIC_LABEL[p.data.topic]}${p.data.urgent ? ", urgent" : ""}):\n\n${p.data.body}\n\nReply: ${site()}/admin?tab=support&t=${id}`,
  );
  return { ok: true, id, ref };
}

export async function replyToMyTicket(id: string, text: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser(`/app/support/${id}`);
  const b = body.safeParse(text);
  if (!uuid.safeParse(id).success || !b.success) return { ok: false, error: b.success ? "Request not found." : b.error.issues[0].message };
  const ok = await asQ(user.id, (q) => store.customerReply(q, id, user.email ?? "", b.data)).catch(() => false);
  if (!ok) return { ok: false, error: "Request not found." };
  const t = await asQ(user.id, (q) => store.getMyTicket(q, id)).catch(() => null);
  const ref = t ? store.ticketRef(t.ticket) : "a request";
  await alertAdmins(`[${ref}] Re: ${t?.ticket.subject ?? "a request"}`, `${user.email} replied on ${ref}:\n\n${b.data}\n\nReply: ${site()}/admin?tab=support&t=${id}`);
  return { ok: true };
}

export async function resolveMyTicket(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser(`/app/support/${id}`);
  if (!uuid.safeParse(id).success) return { ok: false };
  return { ok: await asQ(user.id, (q) => store.customerResolve(q, id)).catch(() => false) };
}

/* -------------------------------------------------------------------- admin */

const TABS = ["needs_reply", "waiting", "resolved", "all", "mine"] as const;
export type SupportTab = (typeof TABS)[number];

export async function getSupportInbox(params: { tab?: string; search?: string; topic?: string; priority?: string; channel?: string; ticket?: string }, actor?: SupportActor) {
  const admin = await adminOr(actor);
  const sla = supportSlaHours();
  const tab: SupportTab = (TABS as readonly string[]).includes(params.tab ?? "") ? (params.tab as SupportTab) : "needs_reply";
  const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) => ((allowed as readonly string[]).includes(v ?? "") ? (v as T) : null);
  const filter = {
    tab,
    me: admin.email ?? "",
    search: (params.search ?? "").trim().slice(0, 100),
    topic: pick(params.topic, store.SUPPORT_TOPICS),
    priority: pick(params.priority, ["normal", "urgent"] as const),
    channel: pick(params.channel, ["app", "admin"] as const),
    slaHours: sla,
  };
  try {
    return await svc(async (q) => {
      const [counts, list] = [await store.counts(q, sla), await store.queue(q, filter)];
      const selectedId = params.ticket && uuid.safeParse(params.ticket).success ? params.ticket : null;
      const selected = selectedId ? await store.adminTicket(q, selectedId, sla) : null;
      const customer = selected ? await store.customerContext(q, selected.ticket.user_id, selected.ticket.workspace_id, trialDays()) : null;
      return { ready: true as const, me: admin.email ?? "", sla, tz: adminTimeZone(), filter, counts, list, selected, customer, topics: SUPPORT_TOPIC_OPTIONS };
    });
  } catch {
    return { ready: false as const, me: admin.email ?? "", sla, tz: adminTimeZone(), filter, counts: { needsReply: 0, urgent: 0, overdue: 0 }, list: [], selected: null, customer: null, topics: SUPPORT_TOPIC_OPTIONS };
  }
}

/** Your answer (emailed to them and shown in their app), or an internal note (only admins see it). */
export async function adminReplyToTicket(id: string, text: unknown, internal: boolean, actor?: SupportActor): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await adminOr(actor);
  const b = body.safeParse(text);
  if (!uuid.safeParse(id).success || !b.success) return { ok: false, error: b.success ? "Request not found." : b.error.issues[0].message };
  const t = await svc((q) => store.adminTicket(q, id, supportSlaHours()));
  if (!t) return { ok: false, error: "Request not found." };
  await svc((q) => store.adminReply(q, id, admin.email ?? "admin", b.data, internal));
  if (!internal) await tellCustomer(t.ticket, b.data);
  return { ok: true };
}

async function tellCustomer(t: store.TicketRow, reply: string) {
  const link = `${site()}/app/support/${t.id}`;
  const ref = store.ticketRef(t);
  if (t.workspace_id)
    await notifyWorkspace(t.workspace_id, "support_reply", { title: `We replied to ${ref}`, body: reply.replace(/\s+/g, " ").slice(0, 160), href: `/app/support/${t.id}`, level: "info", to: { userId: t.user_id }, dedupeKey: `support:${t.id}:${Date.now()}` });
  await sendEmail(t.email, `Re: [${ref}] ${t.subject}`, `${reply}\n\nSee the whole conversation or reply: ${link}\n\nHappy Sending,\nThe Locenti Team`, { from: from(), replyTo: brand.supportEmail }).catch(() => undefined);
}

export async function adminUpdateTicket(id: string, patch: { status?: string; priority?: string; assignToMe?: boolean; unassign?: boolean; topic?: string }, actor?: SupportActor): Promise<{ ok: boolean }> {
  const admin = await adminOr(actor);
  if (!uuid.safeParse(id).success) return { ok: false };
  const p = z
    .object({ status: z.enum(["needs_reply", "waiting", "resolved"]).optional(), priority: z.enum(["normal", "urgent"]).optional(), topic: z.enum(store.SUPPORT_TOPICS).optional() })
    .safeParse({ status: patch.status, priority: patch.priority, topic: patch.topic });
  if (!p.success) return { ok: false };
  const assignedTo = patch.assignToMe ? (admin.email ?? null) : patch.unassign ? null : undefined;
  return { ok: await svc((q) => store.adminUpdate(q, id, { ...p.data, assignedTo })) };
}

/** For the admin header: how many requests are waiting on us (0 if support isn't set up yet). */
export async function supportBadge(): Promise<{ needsReply: number; urgent: number; overdue: number }> {
  await requireAdmin();
  return svc((q) => store.counts(q, supportSlaHours())).catch(() => ({ needsReply: 0, urgent: 0, overdue: 0 }));
}

/** A request's id from its number ("LOC-1042" or "1042"), for the admin API. */
export async function supportTicketIdByRef(ref: string, actor?: SupportActor): Promise<string | null> {
  await adminOr(actor);
  return svc((q) => store.ticketIdByNumber(q, ref)).catch(() => null);
}

export async function findSupportUsers(search: string) {
  await requireAdmin();
  return svc((q) => store.findUsers(q, String(search ?? "").trim().slice(0, 100)));
}

const startSchema = z.object({ userId: uuid, subject: z.string().trim().min(3, "Add a subject.").max(200), body });

/** "Message": start a conversation with a user; they get it in the app and by email. */
export async function adminStartConversation(input: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const p = startSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  try {
    const u = (
      await svc((q) =>
        q.query<{ id: string; email: string | null; workspace_id: string | null }>(
          "select u.id, u.email, (select m.workspace_id from public.memberships m where m.user_id = u.id order by (m.role = 'owner') desc limit 1) as workspace_id from auth.users u where u.id = $1",
          [p.data.userId],
        ),
      )
    ).rows[0];
    if (!u?.email) return { ok: false, error: "That person wasn't found." };
    const email = u.email;
    const id = await svc((q) => store.adminStart(q, { userId: u.id, workspaceId: u.workspace_id, email, subject: p.data.subject, body: p.data.body, adminEmail: admin.email ?? "admin" }));
    const t = await svc((q) => store.adminTicket(q, id, supportSlaHours()));
    if (t) await tellCustomer(t.ticket, p.data.body);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Couldn't start the conversation: run the database update 0019_support.sql in Neon first." };
  }
}

/** For the app's sidebar: does this person have a reply waiting? */
export async function hasSupportReply(): Promise<boolean> {
  const { user } = await requireWorkspace("/app");
  return asQ(user.id, async (q) => (await q.query("select 1 from public.support_tickets where user_id = auth.uid() and status = 'waiting' limit 1")).rows.length > 0).catch(() => false);
}
