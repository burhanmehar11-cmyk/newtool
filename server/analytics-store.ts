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

/* ===================================================================== leads */

export type LeadTotals = { searches: number; found: number; saved: number; researched: number; emails: number };

/** Discovery for [from, to): searches run, businesses found (as charged), leads saved, websites researched, public emails found. */
export async function leadTotals(q: Q, ws: string, from: Date, to: Date): Promise<LeadTotals> {
  const r = await q.query<LeadTotals>(
    `select
       (select count(*)::int from public.discovery_jobs j where j.workspace_id = $1 and j.status = 'completed' and j.created_at >= $2 and j.created_at < $3) as searches,
       (select coalesce(sum(j.charged_units), 0)::int from public.discovery_jobs j where j.workspace_id = $1 and j.status = 'completed' and j.created_at >= $2 and j.created_at < $3) as found,
       (select count(*)::int from public.leads l where l.workspace_id = $1 and l.created_at >= $2 and l.created_at < $3) as saved,
       (select count(*)::int from public.businesses b where b.workspace_id = $1 and b.researched_at >= $2 and b.researched_at < $3 and exists (select 1 from public.leads l where l.business_id = b.id)) as researched,
       (select count(*)::int from public.contacts c where c.workspace_id = $1 and c.created_at >= $2 and c.created_at < $3 and c.status <> 'invalid') as emails`,
    [ws, from, to],
  );
  return r.rows[0];
}

export type LeadDay = { day: string; found: number; saved: number };

export async function dailyLeads(q: Q, ws: string, days: number): Promise<LeadDay[]> {
  return (
    await q.query<LeadDay>(
      `with d as (select generate_series((now() at time zone 'utc')::date - ($2::int - 1), (now() at time zone 'utc')::date, interval '1 day')::date as day)
       select to_char(d.day, 'YYYY-MM-DD') as day,
         (select coalesce(sum(j.charged_units), 0)::int from public.discovery_jobs j where j.workspace_id = $1 and j.status = 'completed' and (j.created_at at time zone 'utc')::date = d.day) as found,
         (select count(*)::int from public.leads l where l.workspace_id = $1 and (l.created_at at time zone 'utc')::date = d.day) as saved
       from d order by d.day`,
      [ws, days],
    )
  ).rows;
}

export type LeadFunnel = { found: number; saved: number; researched: number; withEmail: number; strongFit: number; contacted: number; replied: number };

/** All-time path from a search result to a conversation. */
export async function leadFunnel(q: Q, ws: string): Promise<LeadFunnel> {
  const r = await q.query<LeadFunnel>(
    `with latest as (
       select distinct on (br.business_id) br.business_id, br.payload->'fit'->>'level' as fit
       from public.briefs br where br.workspace_id = $1 order by br.business_id, br.created_at desc)
     select
       (select coalesce(sum(j.charged_units), 0)::int from public.discovery_jobs j where j.workspace_id = $1 and j.status = 'completed') as found,
       (select count(*)::int from public.leads l where l.workspace_id = $1) as saved,
       (select count(*)::int from public.leads l join public.businesses b on b.id = l.business_id where l.workspace_id = $1 and b.researched_at is not null) as researched,
       (select count(*)::int from public.leads l where l.workspace_id = $1 and exists (select 1 from public.contacts c where c.business_id = l.business_id and c.status <> 'invalid')) as "withEmail",
       (select count(*)::int from public.leads l join latest on latest.business_id = l.business_id where l.workspace_id = $1 and latest.fit = 'strong') as "strongFit",
       (select count(distinct e.lead_id)::int from public.enrollments e join public.dispatches x on x.enrollment_id = e.id and x.status = 'accepted' where e.workspace_id = $1) as contacted,
       (select count(distinct t.lead_id)::int from public.threads t where t.workspace_id = $1 and t.last_inbound_at is not null and t.classification not in ('out_of_office', 'bounce')) as replied`,
    [ws],
  );
  return r.rows[0];
}

export type LeadQuality = { strong: number; moderate: number; weak: number; notResearched: number; withEmail: number; withWebsite: number; total: number };

export async function leadQuality(q: Q, ws: string): Promise<LeadQuality> {
  const r = await q.query<LeadQuality>(
    `with latest as (
       select distinct on (br.business_id) br.business_id, br.payload->'fit'->>'level' as fit
       from public.briefs br where br.workspace_id = $1 order by br.business_id, br.created_at desc),
     l as (
       select b.id, b.website, latest.fit,
         exists (select 1 from public.contacts c where c.business_id = b.id and c.status <> 'invalid') as has_email
       from public.leads ld join public.businesses b on b.id = ld.business_id left join latest on latest.business_id = b.id
       where ld.workspace_id = $1)
     select count(*) filter (where fit = 'strong')::int as strong, count(*) filter (where fit = 'moderate')::int as moderate,
       count(*) filter (where fit = 'weak')::int as weak, count(*) filter (where fit is null)::int as "notResearched",
       count(*) filter (where has_email)::int as "withEmail", count(*) filter (where website is not null)::int as "withWebsite", count(*)::int as total
     from l`,
    [ws],
  );
  return r.rows[0];
}

export type Opportunity = { key: string; label: string; detail: string; count: number };

/**
 * What research found across saved leads: the selling points for an agency.
 * Only counts what the business's own website showed (null signals = Unknown, not counted).
 */
export async function opportunities(q: Q, ws: string): Promise<{ researched: number; items: Opportunity[] }> {
  const r = await q.query<{ researched: number; no_booking: number; old_site: number; no_mobile: number; no_form: number; pdf_forms: number; no_website: number }>(
    `select count(*) filter (where b.researched_at is not null)::int as researched,
       count(*) filter (where (b.signals->>'onlineBooking') = 'false')::int as no_booking,
       count(*) filter (where (b.signals->>'siteCopyrightYear') ~ '^\\d{4}$' and (b.signals->>'siteCopyrightYear')::int <= extract(year from now())::int - 3)::int as old_site,
       count(*) filter (where (b.signals->>'mobileViewport') = 'false')::int as no_mobile,
       count(*) filter (where (b.signals->>'contactForm') = 'false')::int as no_form,
       count(*) filter (where (b.signals->>'intakeMethod') = 'pdf_forms')::int as pdf_forms,
       count(*) filter (where b.research_status = 'no_website' or (b.website is null and b.researched_at is not null))::int as no_website
     from public.leads l join public.businesses b on b.id = l.business_id where l.workspace_id = $1`,
    [ws],
  );
  const x = r.rows[0];
  const items: Opportunity[] = [
    { key: "no_booking", label: "No online booking", detail: "Website asks visitors to call to book", count: x.no_booking },
    { key: "old_site", label: "Outdated website", detail: "Footer copyright 3+ years old", count: x.old_site },
    { key: "no_mobile", label: "Not mobile-friendly", detail: "No mobile viewport set", count: x.no_mobile },
    { key: "no_form", label: "No contact form", detail: "Contact page without a form", count: x.no_form },
    { key: "pdf_forms", label: "Paper or PDF forms", detail: "Intake forms are printable PDFs", count: x.pdf_forms },
    { key: "no_website", label: "No website", detail: "No site found to research", count: x.no_website },
  ];
  return { researched: x.researched, items: items.sort((a, b) => b.count - a.count) };
}

export type NicheRow = { niche: string; leads: number; researched: number; withEmail: number; strong: number; contacted: number; replied: number };

export async function leadsByNiche(q: Q, ws: string): Promise<NicheRow[]> {
  return (
    await q.query<NicheRow>(
      `with latest as (
         select distinct on (br.business_id) br.business_id, br.payload->'fit'->>'level' as fit
         from public.briefs br where br.workspace_id = $1 order by br.business_id, br.created_at desc)
       select coalesce(b.niche, 'other') as niche, count(*)::int as leads,
         count(*) filter (where b.researched_at is not null)::int as researched,
         count(*) filter (where exists (select 1 from public.contacts c where c.business_id = b.id and c.status <> 'invalid'))::int as "withEmail",
         count(*) filter (where latest.fit = 'strong')::int as strong,
         count(*) filter (where exists (select 1 from public.enrollments e join public.dispatches x on x.enrollment_id = e.id and x.status = 'accepted' where e.lead_id = l.id))::int as contacted,
         count(*) filter (where exists (select 1 from public.threads t where t.lead_id = l.id and t.last_inbound_at is not null and t.classification not in ('out_of_office', 'bounce')))::int as replied
       from public.leads l join public.businesses b on b.id = l.business_id left join latest on latest.business_id = b.id
       where l.workspace_id = $1 group by 1 order by leads desc limit 12`,
      [ws],
    )
  ).rows;
}

export type SearchRow = { id: string; query: string; provider: string; found: number; status: string; created_at: string; place: string | null };

export async function recentSearches(q: Q, ws: string, limit = 6): Promise<SearchRow[]> {
  return (
    await q.query<SearchRow>(
      "select id, query, provider, charged_units as found, status, created_at, filters->>'place' as place from public.discovery_jobs where workspace_id = $1 order by created_at desc limit $2",
      [ws, limit],
    )
  ).rows;
}

export type AreaRow = { place: string; searches: number; found: number; last_at: string; google: number };

export async function searchAreas(q: Q, ws: string): Promise<AreaRow[]> {
  return (
    await q.query<AreaRow>(
      `select max(trim(filters->>'place')) as place, count(*)::int as searches, coalesce(sum(charged_units), 0)::int as found, max(created_at) as last_at,
         count(*) filter (where provider = 'google_places')::int as google
       from public.discovery_jobs where workspace_id = $1 and status = 'completed' and coalesce(filters->>'place', '') <> ''
       group by lower(trim(filters->>'place')) order by found desc limit 10`,
      [ws],
    )
  ).rows;
}
