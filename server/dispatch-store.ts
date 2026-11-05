import type { Schedule } from "@/lib/campaigns/schedule";
import type { Q } from "@/server/auth-store";

/**
 * Sending bookkeeping on the service connection (the sender runs without a
 * signed-in user). Every function is scoped by explicit ids.
 */

export type RunningCampaign = {
  id: string;
  workspace_id: string;
  schedule: Schedule;
  account_id: string;
  account_email: string;
  sender_name: string | null;
  daily_cap: number;
  account_status: string;
  business_address: string | null;
};

export async function runningCampaigns(q: Q, workspaceId: string | null): Promise<RunningCampaign[]> {
  return (
    await q.query<RunningCampaign>(
      `select c.id, c.workspace_id, c.schedule, sa.id as account_id, sa.email as account_email, sa.sender_name, sa.daily_cap, sa.status as account_status,
         o.business_address
       from public.campaigns c
       join public.sending_accounts sa on sa.id = c.sending_account_id
       left join public.offer_profiles o on o.workspace_id = c.workspace_id
       where c.status = 'running' and ($1::uuid is null or c.workspace_id = $1)
       order by c.launched_at`,
      [workspaceId],
    )
  ).rows;
}

/** Emails from this mailbox counted against today's limit (in the campaign's time zone), plus the last attempt time. */
export async function mailboxUsage(q: Q, accountId: string, timezone: string): Promise<{ today: number; lastAt: string | null }> {
  const r = await q.query<{ today: number; last_at: string | null }>(
    `select count(*) filter (where attempted_at >= (date_trunc('day', now() at time zone $2) at time zone $2) and status in ('sending', 'accepted', 'ambiguous'))::int as today,
            max(attempted_at) as last_at
     from public.dispatches where sending_account_id = $1`,
    [accountId, timezone],
  );
  return { today: r.rows[0]?.today ?? 0, lastAt: r.rows[0]?.last_at ?? null };
}

export type DueEnrollment = {
  id: string;
  lead_id: string;
  email: string;
  /** 0 for the first email, 1 or 2 for follow-ups. */
  step: number;
  subject: string;
  body: string;
  business_name: string;
  /** Follow-up template (step > 0). */
  step_body: string | null;
  /** Gmail thread of the first email, and the Message-IDs sent so far (oldest first). */
  thread_id: string | null;
  message_ids: string[];
};

/**
 * The next email due in a campaign: a queued first email, or a follow-up
 * whose wait is over (state 'sent' with next_send_at in the past). Never one
 * that already has a dispatch for that step.
 */
export async function nextDue(q: Q, campaignId: string): Promise<DueEnrollment | null> {
  return (
    (
      await q.query<DueEnrollment>(
        `select e.id, e.lead_id, e.email, e.step, d.subject, d.body, b.name as business_name, s.body as step_body,
           (select t.provider_thread_id from public.threads t where t.campaign_id = e.campaign_id and t.lead_id = e.lead_id order by (select min(m.occurred_at) from public.messages m where m.thread_id = t.id) nulls last limit 1) as thread_id,
           coalesce(array(select x.rfc_message_id from public.dispatches x where x.enrollment_id = e.id and x.status = 'accepted' and x.rfc_message_id is not null order by x.step), '{}') as message_ids
         from public.enrollments e
         join public.drafts d on d.id = e.draft_id
         join public.leads l on l.id = e.lead_id
         join public.businesses b on b.id = l.business_id
         left join public.campaign_steps s on s.campaign_id = e.campaign_id and s.kind = 'follow_up' and s.position = e.step
         where e.campaign_id = $1
           and ((e.state = 'queued' and e.step = 0 and (e.next_send_at is null or e.next_send_at <= now()))
             or (e.state = 'sent' and e.step > 0 and s.id is not null and e.next_send_at is not null and e.next_send_at <= now()))
           and not exists (select 1 from public.dispatches x where x.enrollment_id = e.id and x.step = e.step)
         order by e.next_send_at nulls first, e.updated_at, e.id limit 1`,
        [campaignId],
      )
    ).rows[0] ?? null
  );
}

export async function isSuppressedEmail(q: Q, ws: string, email: string): Promise<boolean> {
  const r = await q.query(
    `select 1 from public.suppression_entries s where s.workspace_id = $1 and (
       (s.kind = 'email' and s.value = lower($2)) or
       (s.kind = 'domain' and (split_part(lower($2), '@', 2) = s.value or split_part(lower($2), '@', 2) like '%.' || s.value))) limit 1`,
    [ws, email],
  );
  return r.rows.length > 0;
}

/** Claims the send. The unique (enrollment, step) key means a second claim gets nothing, so nobody is emailed twice. */
export async function claimDispatch(q: Q, ws: string, campaignId: string, enrollmentId: string, accountId: string, step = 0): Promise<string | null> {
  const r = await q.query<{ id: string }>(
    `insert into public.dispatches (workspace_id, enrollment_id, step, status, attempted_at, campaign_id, sending_account_id)
     values ($1, $2, $5, 'sending', now(), $3, $4) on conflict (enrollment_id, step) do nothing returning id`,
    [ws, enrollmentId, campaignId, accountId, step],
  );
  return r.rows[0]?.id ?? null;
}

export async function recordAccepted(
  q: Q,
  p: { ws: string; dispatchId: string; enrollmentId: string; leadId: string; campaignId: string; accountId?: string; messageId: string; threadId: string; from: string; to: string; subject: string; body: string; step?: number; rfcMessageId?: string },
) {
  const step = p.step ?? 0;
  await q.query("update public.dispatches set status = 'accepted', provider_message_id = $2, accepted_at = now(), error = null, rfc_message_id = $3 where id = $1", [p.dispatchId, p.messageId, p.rfcMessageId ?? null]);
  // Schedule the next follow-up, if there is one. A reply or stop that landed meanwhile wins.
  const next = (await q.query<{ position: number; delay_days: number }>("select position, delay_days from public.campaign_steps where campaign_id = $1 and kind = 'follow_up' and position = $2", [p.campaignId, step + 1])).rows[0];
  await q.query(
    `update public.enrollments set state = 'sent', updated_at = now(), step = $2,
       next_send_at = case when $3::int is null then null else now() + make_interval(days => $3::int) end
     where id = $1 and state in ('queued', 'sent')`,
    [p.enrollmentId, next ? next.position : step, next ? next.delay_days : null],
  );
  const t = await q.query<{ id: string }>(
    `insert into public.threads (workspace_id, lead_id, campaign_id, provider_thread_id, subject, unread, sending_account_id)
     values ($1, $2, $3, $4, $5, false, $6)
     on conflict (workspace_id, provider_thread_id) do update set updated_at = now() returning id`,
    [p.ws, p.leadId, p.campaignId, p.threadId, p.subject.slice(0, 300), p.accountId ?? null],
  );
  await q.query(
    `insert into public.messages (workspace_id, thread_id, direction, provider_message_id, from_addr, to_addr, subject, body_text, occurred_at)
     values ($1, $2, 'outbound', $3, $4, $5, $6, $7, now()) on conflict (workspace_id, provider_message_id) do nothing`,
    [p.ws, t.rows[0].id, p.messageId, p.from, p.to, p.subject, p.body],
  );
}

/**
 * failed: Gmail said no; the enrollment stops with the reason.
 * ambiguous: we can't tell whether Gmail accepted it (network cut after sending);
 * never retried automatically, to avoid a duplicate email.
 */
export async function recordFailure(q: Q, dispatchId: string, enrollmentId: string, status: "failed" | "ambiguous" | "cancelled", error: string, step = 0) {
  await q.query("update public.dispatches set status = $2, error = $3 where id = $1", [dispatchId, status, error.slice(0, 500)]);
  const reason = status === "ambiguous" ? "Unclear whether Gmail sent it. Check your Sent folder." : status === "cancelled" ? "On the do-not-contact list" : error.slice(0, 300);
  if (step === 0) {
    await q.query("update public.enrollments set state = 'stopped', reason = $2, updated_at = now() where id = $1", [enrollmentId, reason]);
  } else {
    // The first email went out, so the enrollment stays 'sent'; only further follow-ups stop.
    await q.query("update public.enrollments set next_send_at = null, reason = $2, updated_at = now() where id = $1 and state = 'sent'", [enrollmentId, `Follow-up stopped: ${reason}`]);
  }
}

export async function pauseCampaign(q: Q, campaignId: string) {
  await q.query("update public.campaigns set status = 'paused' where id = $1 and status = 'running'", [campaignId]);
}

/** Marks running campaigns with nothing left to send (no first emails, no follow-ups waiting) as completed. */
export async function completeFinished(q: Q, campaignId: string) {
  await q.query(
    `update public.campaigns set status = 'completed' where id = $1 and status = 'running'
       and not exists (select 1 from public.enrollments e where e.campaign_id = $1
         and (e.state = 'queued' or (e.state = 'sent' and e.step > 0 and e.next_send_at is not null)))`,
    [campaignId],
  );
}
