import type { Q } from "@/server/auth-store";
import type { ReplyKind } from "@/lib/replies/classify";

/** Reply sync bookkeeping (service connection) and inbox reads (user connection, RLS). */

export type SyncThread = { id: string; workspace_id: string; provider_thread_id: string; lead_id: string | null; campaign_id: string | null; classification_source: string };

/** Threads this mailbox started in the last 45 days, oldest-synced first. */
export async function threadsForMailbox(q: Q, accountId: string, limit = 25): Promise<SyncThread[]> {
  return (
    await q.query<SyncThread>(
      `select t.id, t.workspace_id, t.provider_thread_id, t.lead_id, t.campaign_id, t.classification_source
       from public.threads t
       left join public.campaigns c on c.id = t.campaign_id
       where coalesce(t.sending_account_id, c.sending_account_id) = $1
         and exists (select 1 from public.messages m where m.thread_id = t.id and m.direction = 'outbound' and m.occurred_at > now() - interval '45 days')
       order by coalesce(t.last_inbound_at, 'epoch'::timestamptz), t.updated_at limit $2`,
      [accountId, limit],
    )
  ).rows;
}

/** Our sent emails' Message-IDs (last 45 days) and the conversation each belongs to: replies point back at them. */
export async function sentMessageThreads(q: Q, accountId: string): Promise<Map<string, SyncThread>> {
  const r = await q.query<SyncThread & { rfc: string }>(
    `select lower(d.rfc_message_id) as rfc, t.id, t.workspace_id, t.provider_thread_id, t.lead_id, t.campaign_id, t.classification_source
     from public.dispatches d
     join public.messages m on m.workspace_id = d.workspace_id and m.provider_message_id = d.provider_message_id and m.direction = 'outbound'
     join public.threads t on t.id = m.thread_id
     where d.sending_account_id = $1 and d.status = 'accepted' and d.rfc_message_id is not null and d.accepted_at > now() - interval '45 days'`,
    [accountId],
  );
  return new Map(r.rows.map(({ rfc, ...t }) => [rfc, t]));
}

export async function knownMessageIds(q: Q, threadId: string): Promise<Set<string>> {
  return new Set((await q.query<{ provider_message_id: string }>("select provider_message_id from public.messages where thread_id = $1", [threadId])).rows.map((r) => r.provider_message_id));
}

export async function recordInbound(
  q: Q,
  p: { ws: string; threadId: string; messageId: string; from: string; to: string; subject: string; text: string; at: Date; kind: ReplyKind; classificationSource: string; leadId: string | null; campaignId: string | null },
): Promise<boolean> {
  const ins = await q.query(
    `insert into public.messages (workspace_id, thread_id, direction, provider_message_id, from_addr, to_addr, subject, body_text, occurred_at)
     values ($1, $2, 'inbound', $3, $4, $5, $6, $7, $8) on conflict (workspace_id, provider_message_id) do nothing returning id`,
    [p.ws, p.threadId, p.messageId, p.from.slice(0, 300), p.to.slice(0, 300), p.subject.slice(0, 300), p.text, p.at],
  );
  if (!ins.rows.length) return false;
  // Keep a person's own label; otherwise update the suggestion. Out-of-office doesn't overwrite a real answer.
  await q.query(
    `update public.threads set unread = true, last_inbound_at = greatest(coalesce(last_inbound_at, 'epoch'::timestamptz), $2), updated_at = now(),
       classification = case when classification_source = 'user' then classification
                             when $3 = 'out_of_office' and classification in ('interested', 'not_interested') then classification
                             else $3 end
     where id = $1`,
    [p.threadId, p.at, p.kind],
  );
  if (p.campaignId && p.leadId && p.kind !== "out_of_office") {
    await q.query("update public.enrollments set state = 'replied', reason = null, updated_at = now() where campaign_id = $1 and lead_id = $2 and state in ('queued', 'sent')", [p.campaignId, p.leadId]);
  }
  return true;
}

export async function markSynced(q: Q, accountId: string) {
  await q.query("update public.sending_accounts set last_synced_at = now() where id = $1", [accountId]);
}

export type MailboxForSync = { id: string; workspace_id: string; email: string; scopes: string | null; last_synced_at: string | null; provider: string };

export async function mailboxesForSync(q: Q, workspaceId: string): Promise<MailboxForSync[]> {
  return (await q.query<MailboxForSync>("select id, workspace_id, email, scopes, last_synced_at, provider from public.sending_accounts where workspace_id = $1 and status = 'connected'", [workspaceId])).rows;
}

/* --------------------------------------------------------------- inbox (RLS) */

export type InboxRow = {
  id: string;
  provider_thread_id: string;
  subject: string;
  classification: ReplyKind;
  classification_source: string;
  unread: boolean;
  last_inbound_at: string;
  lead_id: string | null;
  name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  mailbox_email: string | null;
  last_from: string | null;
  last_text: string | null;
};

export async function inboxThreads(q: Q, ws: string, filter: ReplyKind | "all"): Promise<InboxRow[]> {
  return (
    await q.query<InboxRow>(
      `select t.id, t.provider_thread_id, t.subject, t.classification, t.classification_source, t.unread, t.last_inbound_at, t.lead_id, b.name, t.campaign_id, c.name as campaign_name,
         sa.email as mailbox_email, m.from_addr as last_from, left(m.body_text, 220) as last_text
       from public.threads t
       left join public.leads l on l.id = t.lead_id
       left join public.businesses b on b.id = l.business_id
       left join public.campaigns c on c.id = t.campaign_id
       left join public.sending_accounts sa on sa.id = coalesce(t.sending_account_id, c.sending_account_id)
       left join lateral (select from_addr, body_text from public.messages m where m.thread_id = t.id and m.direction = 'inbound' order by m.occurred_at desc limit 1) m on true
       where t.workspace_id = $1 and t.last_inbound_at is not null and ($2 = 'all' or t.classification = $2)
       order by t.last_inbound_at desc limit 200`,
      [ws, filter],
    )
  ).rows;
}

export type ThreadMessage = { id: string; direction: "outbound" | "inbound"; from_addr: string; to_addr: string; subject: string; body_text: string; occurred_at: string };

export async function threadDetail(q: Q, id: string): Promise<{ thread: InboxRow; messages: ThreadMessage[] } | null> {
  const t = (
    await q.query<InboxRow>(
      `select t.id, t.provider_thread_id, t.subject, t.classification, t.classification_source, t.unread, t.last_inbound_at, t.lead_id, b.name, t.campaign_id, c.name as campaign_name,
         sa.email as mailbox_email, null as last_from, null as last_text
       from public.threads t
       left join public.leads l on l.id = t.lead_id
       left join public.businesses b on b.id = l.business_id
       left join public.campaigns c on c.id = t.campaign_id
       left join public.sending_accounts sa on sa.id = coalesce(t.sending_account_id, c.sending_account_id)
       where t.id = $1`,
      [id],
    )
  ).rows[0];
  if (!t) return null;
  const messages = (await q.query<ThreadMessage>("select id, direction, from_addr, to_addr, subject, body_text, occurred_at from public.messages where thread_id = $1 order by occurred_at", [id])).rows;
  return { thread: t, messages };
}

export async function setThreadState(q: Q, id: string, p: { classification?: ReplyKind; unread?: boolean }) {
  await q.query(
    `update public.threads set classification = coalesce($2, classification), classification_source = case when $2 is null then classification_source else 'user' end, unread = coalesce($3, unread) where id = $1`,
    [id, p.classification ?? null, p.unread ?? null],
  );
}

export async function replyCounts(q: Q, ws: string) {
  return (
    await q.query<{ classification: ReplyKind; n: number; unread: number }>(
      "select classification, count(*)::int as n, count(*) filter (where unread)::int as unread from public.threads where workspace_id = $1 and last_inbound_at is not null group by classification",
      [ws],
    )
  ).rows;
}
