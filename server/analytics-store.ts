import type { Q } from "@/server/auth-store";

/**
 * Workspace analytics, computed from real records (dispatches, replies,
 * leads, suppressions). Runs on the user-scoped connection, so RLS limits
 * every number to the caller's workspace. Nothing is estimated.
 */

export type Totals = { sent: number; replied: number; interested: number; bounced: number; unsubscribed: number; outOfOffice: number };

/** Totals for [from, to). Replies count conversations with a real reply (not out-of-office or bounce). */
export async function totals(q: Q, ws: string, from: Date, to: Date): Promise<Totals> {
  const r = await q.query<Totals>(
    `select
       (select count(*)::int from public.dispatches d where d.workspace_id = $1 and d.status = 'accepted' and d.accepted_at >= $2 and d.accepted_at < $3) as sent,
       (select count(distinct m.thread_id)::int from public.messages m join public.threads t on t.id = m.thread_id
          where m.workspace_id = $1 and m.direction = 'inbound' and m.occurred_at >= $2 and m.occurred_at < $3 and t.classification not in ('out_of_office', 'bounce')) as replied,
       (select count(*)::int from public.threads t where t.workspace_id = $1 and t.classification = 'interested' and t.last_inbound_at >= $2 and t.last_inbound_at < $3) as interested,
       (select count(*)::int from public.threads t where t.workspace_id = $1 and t.classification = 'bounce' and t.last_inbound_at >= $2 and t.last_inbound_at < $3) as bounced,
       (select count(*)::int from public.suppression_entries s where s.workspace_id = $1 and s.reason = 'unsubscribe' and s.created_at >= $2 and s.created_at < $3) as "unsubscribed",
       (select count(*)::int from public.threads t where t.workspace_id = $1 and t.classification = 'out_of_office' and t.last_inbound_at >= $2 and t.last_inbound_at < $3) as "outOfOffice"`,
    [ws, from, to],
  );
  return r.rows[0];
}

export type DayPoint = { day: string; sent: number; replied: number };

/** Daily sent and replied counts for the last `days` days (UTC), zero-filled. */
export async function daily(q: Q, ws: string, days: number): Promise<DayPoint[]> {
  return (
    await q.query<DayPoint>(
      `with d as (select generate_series((now() at time zone 'utc')::date - ($2::int - 1), (now() at time zone 'utc')::date, interval '1 day')::date as day)
       select to_char(d.day, 'YYYY-MM-DD') as day,
         (select count(*)::int from public.dispatches x where x.workspace_id = $1 and x.status = 'accepted' and (x.accepted_at at time zone 'utc')::date = d.day) as sent,
         (select count(distinct m.thread_id)::int from public.messages m join public.threads t on t.id = m.thread_id
            where m.workspace_id = $1 and m.direction = 'inbound' and t.classification not in ('out_of_office', 'bounce') and (m.occurred_at at time zone 'utc')::date = d.day) as replied
       from d order by d.day`,
      [ws, days],
    )
  ).rows;
}

export type Funnel = { leads: number; researched: number; withEmail: number; drafted: number; sent: number; replied: number; interested: number };

/** All-time pipeline, each stage counted in leads. */
export async function funnel(q: Q, ws: string): Promise<Funnel> {
  const r = await q.query<Funnel>(
    `select
       (select count(*)::int from public.leads l where l.workspace_id = $1) as leads,
       (select count(*)::int from public.leads l join public.businesses b on b.id = l.business_id where l.workspace_id = $1 and b.researched_at is not null) as researched,
       (select count(*)::int from public.leads l where l.workspace_id = $1 and exists (select 1 from public.contacts c where c.business_id = l.business_id and c.status <> 'invalid')) as "withEmail",
       (select count(distinct d.lead_id)::int from public.drafts d where d.workspace_id = $1) as drafted,
       (select count(distinct e.lead_id)::int from public.enrollments e join public.dispatches x on x.enrollment_id = e.id and x.status = 'accepted' where e.workspace_id = $1) as sent,
       (select count(distinct t.lead_id)::int from public.threads t where t.workspace_id = $1 and t.last_inbound_at is not null and t.classification not in ('out_of_office', 'bounce')) as replied,
       (select count(distinct t.lead_id)::int from public.threads t where t.workspace_id = $1 and t.classification = 'interested') as interested`,
    [ws],
  );
  return r.rows[0];
}

export type CampaignStat = { id: string; name: string; status: string; recipients: number; sent: number; replied: number; interested: number; bounced: number; launched_at: string | null };

export async function campaignStats(q: Q, ws: string): Promise<CampaignStat[]> {
  return (
    await q.query<CampaignStat>(
      `select c.id, c.name, c.status, c.launched_at,
         (select count(*)::int from public.campaign_recipients r where r.campaign_id = c.id) as recipients,
         (select count(*)::int from public.dispatches x where x.campaign_id = c.id and x.status = 'accepted') as sent,
         (select count(*)::int from public.threads t where t.campaign_id = c.id and t.last_inbound_at is not null and t.classification not in ('out_of_office', 'bounce')) as replied,
         (select count(*)::int from public.threads t where t.campaign_id = c.id and t.classification = 'interested') as interested,
         (select count(*)::int from public.threads t where t.campaign_id = c.id and t.classification = 'bounce') as bounced
       from public.campaigns c where c.workspace_id = $1 and c.status <> 'draft'
       order by c.launched_at desc nulls last limit 50`,
      [ws],
    )
  ).rows;
}

export type Breakdown = { key: string; sent: number; replied: number; interested: number };

/** Results by lead source (Google Maps / OpenStreetMap) and by business type. */
export async function breakdowns(q: Q, ws: string): Promise<{ bySource: Breakdown[]; byNiche: Breakdown[] }> {
  const base = (col: string) => `
    select coalesce(${col}, 'unknown') as key,
      count(distinct x.id)::int as sent,
      count(distinct t.id) filter (where t.last_inbound_at is not null and t.classification not in ('out_of_office', 'bounce'))::int as replied,
      count(distinct t.id) filter (where t.classification = 'interested')::int as interested
    from public.dispatches x
    join public.enrollments e on e.id = x.enrollment_id
    join public.leads l on l.id = e.lead_id
    join public.businesses b on b.id = l.business_id
    left join public.threads t on t.campaign_id = e.campaign_id and t.lead_id = e.lead_id
    where x.workspace_id = $1 and x.status = 'accepted'
    group by 1 order by sent desc limit 12`;
  const [bySource, byNiche] = await Promise.all([q.query<Breakdown>(base("b.provider"), [ws]), q.query<Breakdown>(base("b.niche"), [ws])]);
  return { bySource: bySource.rows, byNiche: byNiche.rows };
}

export type Activity = { kind: "sent" | "reply" | "unsubscribe" | "lead"; at: string; title: string; detail: string | null; href: string | null; label: string | null };

export async function recentActivity(q: Q, ws: string, limit = 12): Promise<Activity[]> {
  return (
    await q.query<Activity>(
      `(select 'sent' as kind, x.accepted_at as at, coalesce(e.email, '') as title, c.name as detail, '/app/campaigns/' || c.id as href, null as label
         from public.dispatches x join public.enrollments e on e.id = x.enrollment_id join public.campaigns c on c.id = x.campaign_id
         where x.workspace_id = $1 and x.status = 'accepted' order by x.accepted_at desc limit $2)
       union all
       (select 'reply', t.last_inbound_at, coalesce(b.name, t.subject), t.subject, '/app/inbox/' || t.id, t.classification
         from public.threads t left join public.leads l on l.id = t.lead_id left join public.businesses b on b.id = l.business_id
         where t.workspace_id = $1 and t.last_inbound_at is not null order by t.last_inbound_at desc limit $2)
       union all
       (select 'unsubscribe', s.created_at, s.value, null, '/app/campaigns', null
         from public.suppression_entries s where s.workspace_id = $1 and s.reason in ('unsubscribe', 'bounce') order by s.created_at desc limit $2)
       union all
       (select 'lead', l.created_at, b.name, b.domain_normalized, '/app/leads/' || l.id, null
         from public.leads l join public.businesses b on b.id = l.business_id where l.workspace_id = $1 order by l.created_at desc limit $2)
       order by at desc limit $2`,
      [ws, limit],
    )
  ).rows;
}

export type SendingToday = { mailboxes: number; connected: number; capToday: number; sentToday: number; replyTracking: number };

export async function sendingToday(q: Q, ws: string): Promise<SendingToday> {
  const r = await q.query<SendingToday>(
    `select count(*)::int as mailboxes,
       count(*) filter (where status = 'connected')::int as connected,
       coalesce(sum(daily_cap) filter (where status = 'connected'), 0)::int as "capToday",
       (select count(*)::int from public.dispatches x where x.workspace_id = $1 and x.status = 'accepted' and x.accepted_at >= date_trunc('day', now())) as "sentToday",
       count(*) filter (where status = 'connected' and scopes like '%gmail.readonly%')::int as "replyTracking"
     from public.sending_accounts where workspace_id = $1 and status <> 'disconnected'`,
    [ws],
  );
  return r.rows[0];
}
