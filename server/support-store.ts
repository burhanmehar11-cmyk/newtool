import type { Q } from "@/server/auth-store";

export const SUPPORT_TOPICS = ["account", "billing", "search", "mailbox", "campaigns", "bug", "feature", "other"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];
export type SupportStatus = "needs_reply" | "waiting" | "resolved";
export type SupportPriority = "normal" | "urgent";

export type TicketRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  email: string;
  subject: string;
  topic: SupportTopic;
  priority: SupportPriority;
  channel: "app" | "admin";
  status: SupportStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  last_customer_at: string | null;
  last_admin_at: string | null;
  preview: string | null;
  messages: number;
  overdue: boolean;
};
export type MessageRow = { id: string; author: "customer" | "admin" | "system"; author_email: string | null; body: string; internal: boolean; created_at: string };

const COLS = `t.id, t.user_id, t.workspace_id, t.email, t.subject, t.topic, t.priority, t.channel, t.status, t.assigned_to, t.created_at, t.updated_at, t.last_customer_at, t.last_admin_at,
  (select left(m.body, 160) from public.support_messages m where m.ticket_id = t.id and not m.internal order by m.created_at desc limit 1) as preview,
  (select count(*)::int from public.support_messages m where m.ticket_id = t.id and not m.internal) as messages`;
/** Waiting on us longer than the reply target ($slaHours). */
const OVERDUE = (p: string) => `(t.status = 'needs_reply' and coalesce(t.last_customer_at, t.created_at) < now() - make_interval(hours => ${p}::int))`;

/* ------------------------------------------------ the person (row-level security) */

export async function myTickets(q: Q): Promise<TicketRow[]> {
  return (await q.query<TicketRow>(`select ${COLS}, false as overdue from public.support_tickets t where t.user_id = auth.uid() order by t.updated_at desc limit 50`)).rows;
}

export async function openTicket(q: Q, p: { workspaceId: string | null; email: string; subject: string; topic: SupportTopic; priority: SupportPriority; body: string }): Promise<string> {
  const id = (
    await q.query<{ id: string }>(
      `insert into public.support_tickets (user_id, workspace_id, email, subject, topic, priority, last_customer_at) values (auth.uid(), $1, $2, $3, $4, $5, now()) returning id`,
      [p.workspaceId, p.email, p.subject, p.topic, p.priority],
    )
  ).rows[0].id;
  await q.query("insert into public.support_messages (ticket_id, author, author_email, body) values ($1, 'customer', $2, $3)", [id, p.email, p.body]);
  return id;
}

export async function getMyTicket(q: Q, id: string): Promise<{ ticket: TicketRow; messages: MessageRow[] } | null> {
  const ticket = (await q.query<TicketRow>(`select ${COLS}, false as overdue from public.support_tickets t where t.id = $1`, [id])).rows[0];
  if (!ticket) return null;
  const messages = (await q.query<MessageRow>("select id, author, author_email, body, internal, created_at from public.support_messages where ticket_id = $1 order by created_at", [id])).rows;
  return { ticket, messages };
}

/** A reply from the person reopens the request ("needs reply"). */
export async function customerReply(q: Q, id: string, email: string, body: string): Promise<boolean> {
  const t = (await q.query<{ id: string }>("update public.support_tickets set status = 'needs_reply', updated_at = now(), last_customer_at = now(), resolved_at = null where id = $1 returning id", [id])).rows[0];
  if (!t) return false;
  await q.query("insert into public.support_messages (ticket_id, author, author_email, body) values ($1, 'customer', $2, $3)", [id, email, body]);
  return true;
}

export async function customerResolve(q: Q, id: string): Promise<boolean> {
  return (await q.query("update public.support_tickets set status = 'resolved', updated_at = now(), resolved_at = now() where id = $1 and status <> 'resolved' returning id", [id])).rows.length > 0;
}

/* ------------------------------------------------------- admin (service connection) */

export type QueueFilter = { tab: "needs_reply" | "waiting" | "resolved" | "all" | "mine"; me: string; search: string; topic: string | null; priority: string | null; channel: string | null; slaHours: number };

export async function queue(q: Q, f: QueueFilter): Promise<TicketRow[]> {
  return (
    await q.query<TicketRow>(
      `select ${COLS}, ${OVERDUE("$7")} as overdue from public.support_tickets t
       where ($1 = 'all' or ($1 = 'mine' and t.assigned_to = $2) or t.status = $1)
         and ($3 = '' or t.subject ilike '%' || $3 || '%' or t.email ilike '%' || $3 || '%')
         and ($4::text is null or t.topic = $4) and ($5::text is null or t.priority = $5) and ($6::text is null or t.channel = $6)
       order by (t.status = 'needs_reply' and t.priority = 'urgent') desc, ${OVERDUE("$7")} desc, t.updated_at desc
       limit 200`,
      [f.tab, f.me, f.search, f.topic, f.priority, f.channel, f.slaHours],
    )
  ).rows;
}

export async function counts(q: Q, slaHours: number) {
  const r = (
    await q.query<{ needs_reply: number; urgent: number; overdue: number }>(
      `select count(*) filter (where t.status = 'needs_reply')::int as needs_reply,
              count(*) filter (where t.status = 'needs_reply' and t.priority = 'urgent')::int as urgent,
              count(*) filter (where ${OVERDUE("$1")})::int as overdue
       from public.support_tickets t`,
      [slaHours],
    )
  ).rows[0];
  return { needsReply: r?.needs_reply ?? 0, urgent: r?.urgent ?? 0, overdue: r?.overdue ?? 0 };
}

export async function adminTicket(q: Q, id: string, slaHours: number): Promise<{ ticket: TicketRow; messages: MessageRow[] } | null> {
  const ticket = (await q.query<TicketRow>(`select ${COLS}, ${OVERDUE("$2")} as overdue from public.support_tickets t where t.id = $1`, [id, slaHours])).rows[0];
  if (!ticket) return null;
  const messages = (await q.query<MessageRow>("select id, author, author_email, body, internal, created_at from public.support_messages where ticket_id = $1 order by created_at", [id])).rows;
  return { ticket, messages };
}

/** A reply (status → waiting on them) or an internal note (status unchanged). */
export async function adminReply(q: Q, id: string, adminEmail: string, body: string, internal: boolean): Promise<boolean> {
  const ok = internal
    ? (await q.query("update public.support_tickets set updated_at = now() where id = $1 returning id", [id])).rows.length > 0
    : (await q.query("update public.support_tickets set status = 'waiting', updated_at = now(), last_admin_at = now(), assigned_to = coalesce(assigned_to, $2) where id = $1 returning id", [id, adminEmail])).rows.length > 0;
  if (ok) await q.query("insert into public.support_messages (ticket_id, author, author_email, body, internal) values ($1, 'admin', $2, $3, $4)", [id, adminEmail, body, internal]);
  return ok;
}

export async function adminUpdate(q: Q, id: string, patch: { status?: SupportStatus; priority?: SupportPriority; assignedTo?: string | null; topic?: SupportTopic }): Promise<boolean> {
  return (
    await q.query(
      `update public.support_tickets set
         status = coalesce($2, status), priority = coalesce($3, priority), topic = coalesce($5, topic),
         assigned_to = case when $4::boolean then $6 else assigned_to end,
         resolved_at = case when $2 = 'resolved' then now() when $2 is not null then null else resolved_at end,
         updated_at = now()
       where id = $1 returning id`,
      [id, patch.status ?? null, patch.priority ?? null, patch.assignedTo !== undefined, patch.topic ?? null, patch.assignedTo ?? null],
    )
  ).rows.length > 0;
}

/** "Message": the owner starts a conversation with a user. */
export async function adminStart(q: Q, p: { userId: string; workspaceId: string | null; email: string; subject: string; body: string; adminEmail: string }): Promise<string> {
  const id = (
    await q.query<{ id: string }>(
      `insert into public.support_tickets (user_id, workspace_id, email, subject, channel, status, assigned_to, last_admin_at) values ($1, $2, $3, $4, 'admin', 'waiting', $5, now()) returning id`,
      [p.userId, p.workspaceId, p.email, p.subject, p.adminEmail],
    )
  ).rows[0].id;
  await q.query("insert into public.support_messages (ticket_id, author, author_email, body) values ($1, 'admin', $2, $3)", [id, p.adminEmail, p.body]);
  return id;
}

export type CustomerContext = {
  email: string;
  name: string | null;
  signedUpAt: string;
  lastSignInAt: string | null;
  signUpMethod: "google" | "email";
  workspace: { id: string; name: string; role: string; plan: string; trialDaysLeft: number | null } | null;
  mailboxes: { email: string; status: string }[];
  counts: { leads: number; campaigns: number; sent: number; searches: number };
  tickets: number;
  recent: { at: string; summary: string; outcome: string }[];
};

/** Everything the owner needs next to a conversation, from stored data only. */
export async function customerContext(q: Q, userId: string, workspaceId: string | null, trialDays = 14): Promise<CustomerContext | null> {
  const u = (
    await q.query<{ email: string; name: string | null; created_at: string; last_sign_in_at: string | null; auth_subject: string }>(
      `select email, coalesce(nullif(raw_user_meta_data->>'full_name', ''), nullif(raw_user_meta_data->>'name', '')) as name, created_at, last_sign_in_at, auth_subject from auth.users where id = $1`,
      [userId],
    )
  ).rows[0];
  if (!u) return null;
  const ws = (
    await q.query<{ id: string; name: string; role: string; plan: string | null; trial_days_left: number | null }>(
      `select w.id, w.name, m.role, to_jsonb(w)->>'plan' as plan,
         ceil(extract(epoch from (coalesce((to_jsonb(w)->>'trial_ends_at')::timestamptz, w.created_at + make_interval(days => $3::int)) - now())) / 86400)::int as trial_days_left
       from public.memberships m join public.workspaces w on w.id = m.workspace_id
       where m.user_id = $1 order by (w.id = $2) desc, (m.role = 'owner') desc limit 1`,
      [userId, workspaceId, trialDays],
    )
  ).rows[0];
  const id = ws?.id ?? null;
  const n = id
    ? (
        await q.query<{ leads: number; campaigns: number; sent: number; searches: number }>(
          `select (select count(*)::int from public.leads where workspace_id = $1) as leads,
                  (select count(*)::int from public.campaigns where workspace_id = $1) as campaigns,
                  (select count(*)::int from public.dispatches where workspace_id = $1 and status = 'accepted') as sent,
                  (select count(*)::int from public.discovery_jobs where workspace_id = $1) as searches`,
          [id],
        )
      ).rows[0]
    : { leads: 0, campaigns: 0, sent: 0, searches: 0 };
  const mailboxes = id ? (await q.query<{ email: string; status: string }>("select email, status from public.sending_accounts where workspace_id = $1 and status <> 'disconnected' order by created_at", [id])).rows : [];
  const tickets = (await q.query<{ n: number }>("select count(*)::int as n from public.support_tickets where user_id = $1", [userId])).rows[0]?.n ?? 0;
  const recent = await q
    .query<{ at: string; summary: string; outcome: string }>(
      "select at, summary, outcome from app.activity_events where user_id = $1 or ($2::uuid is not null and workspace_id = $2) order by at desc limit 8",
      [userId, id],
    )
    .then((r) => r.rows)
    .catch(() => []);
  return {
    email: u.email,
    name: u.name,
    signedUpAt: u.created_at,
    lastSignInAt: u.last_sign_in_at,
    signUpMethod: u.auth_subject.startsWith("google:") ? "google" : "email",
    workspace: ws ? { id: ws.id, name: ws.name, role: ws.role, plan: ws.plan ?? "trial", trialDaysLeft: (ws.plan ?? "trial") === "trial" ? ws.trial_days_left : null } : null,
    mailboxes,
    counts: n,
    tickets,
    recent,
  };
}

/** Accounts for the "Message" picker. */
export async function findUsers(q: Q, search: string): Promise<{ id: string; email: string; workspace_id: string | null }[]> {
  return (
    await q.query<{ id: string; email: string; workspace_id: string | null }>(
      `select u.id, u.email, (select m.workspace_id from public.memberships m where m.user_id = u.id order by (m.role = 'owner') desc limit 1) as workspace_id
       from auth.users u where u.email is not null and ($1 = '' or u.email ilike '%' || $1 || '%') order by u.created_at desc limit 20`,
      [search],
    )
  ).rows;
}
