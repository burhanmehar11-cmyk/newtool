import type { Q } from "@/server/auth-store";

/**
 * Platform-wide numbers for the admin panel. Runs on the service connection
 * (all workspaces), so only call it after checking the person is an admin.
 * Every number comes from stored records; nothing is estimated.
 */

export type Plan = "trial" | "free" | "paid" | "comp" | "lapsed";
export const PLANS: Plan[] = ["trial", "free", "paid", "comp", "lapsed"];

/** SQL: when a workspace's trial ends ($trial = TRIAL_DAYS). */
const TRIAL_END = (trialParam: string) => `coalesce(w.trial_ends_at, w.created_at + make_interval(days => ${trialParam}::int))`;

const n = (v: unknown) => Number(v ?? 0);

export type Overview = {
  users: number;
  users7: number;
  users30: number;
  usersPrev30: number;
  workspaces: number;
  active7: number;
  plans: Record<Plan, number>;
  trialsEndingSoon: number;
  trialsExpired: number;
  sent30: number;
  replies30: number;
  searches30: number;
  leads30: number;
  visits30: number;
};

export async function overview(q: Q, trialDays: number): Promise<Overview> {
  const r = (
    await q.query(
      `select
         (select count(*) from auth.users) as users,
         (select count(*) from auth.users where created_at > now() - interval '7 days') as users7,
         (select count(*) from auth.users where created_at > now() - interval '30 days') as users30,
         (select count(*) from auth.users where created_at <= now() - interval '30 days' and created_at > now() - interval '60 days') as users_prev30,
         (select count(*) from public.workspaces) as workspaces,
         (select count(distinct x.ws) from (
            select workspace_id as ws from public.discovery_jobs where created_at > now() - interval '7 days'
            union all select workspace_id from public.leads where created_at > now() - interval '7 days'
            union all select workspace_id from public.dispatches where attempted_at > now() - interval '7 days'
            union all select workspace_id from public.drafts where created_at > now() - interval '7 days') x) as active7,
         (select count(*) from public.workspaces w where w.plan = 'trial' and ${TRIAL_END("$1")} between now() and now() + interval '7 days') as trials_soon,
         (select count(*) from public.workspaces w where w.plan = 'trial' and ${TRIAL_END("$1")} < now()) as trials_expired,
         (select count(*) from public.dispatches where status = 'accepted' and accepted_at > now() - interval '30 days') as sent30,
         (select count(*) from public.messages where direction = 'inbound' and occurred_at > now() - interval '30 days') as replies30,
         (select count(*) from public.discovery_jobs where created_at > now() - interval '30 days') as searches30,
         (select count(*) from public.leads where created_at > now() - interval '30 days') as leads30,
         (select coalesce(sum(visits), 0) from app.site_visits where day > (now() at time zone 'utc')::date - 30) as visits30`,
      [trialDays],
    )
  ).rows[0] as Record<string, unknown>;
  const plans = Object.fromEntries(PLANS.map((p) => [p, 0])) as Record<Plan, number>;
  for (const row of (await q.query<{ plan: Plan; c: string }>("select plan, count(*) as c from public.workspaces group by plan")).rows) plans[row.plan] = n(row.c);
  return {
    users: n(r.users),
    users7: n(r.users7),
    users30: n(r.users30),
    usersPrev30: n(r.users_prev30),
    workspaces: n(r.workspaces),
    active7: n(r.active7),
    plans,
    trialsEndingSoon: n(r.trials_soon),
    trialsExpired: n(r.trials_expired),
    sent30: n(r.sent30),
    replies30: n(r.replies30),
    searches30: n(r.searches30),
    leads30: n(r.leads30),
    visits30: n(r.visits30),
  };
}

/** Daily series for the last `days` days: sign-ups, first visits, searches, leads, emails, replies, AI drafts. */
export async function daily(q: Q, days: number) {
  return (
    await q.query<Record<string, string | number>>(
      `with d as (select generate_series((now() at time zone 'utc')::date - ($1::int - 1), (now() at time zone 'utc')::date, interval '1 day')::date as day)
       select to_char(d.day, 'YYYY-MM-DD') as day,
         (select count(*)::int from auth.users u where (u.created_at at time zone 'utc')::date = d.day) as signups,
         (select coalesce(sum(v.visits), 0)::int from app.site_visits v where v.day = d.day) as visits,
         (select count(*)::int from public.discovery_jobs j where (j.created_at at time zone 'utc')::date = d.day) as searches,
         (select count(*)::int from public.leads l where (l.created_at at time zone 'utc')::date = d.day) as leads,
         (select count(*)::int from public.briefs b where (b.created_at at time zone 'utc')::date = d.day) as research,
         (select count(*)::int from public.drafts dr where dr.origin in ('ai', 'agent') and (dr.created_at at time zone 'utc')::date = d.day) as ai_drafts,
         (select count(*)::int from public.dispatches x where x.status = 'accepted' and (x.accepted_at at time zone 'utc')::date = d.day) as sent,
         (select count(*)::int from public.messages m where m.direction = 'inbound' and (m.occurred_at at time zone 'utc')::date = d.day) as replied
       from d order by d.day`,
      [days],
    )
  ).rows;
}

export type FunnelStep = { key: string; label: string; count: number };

/** People who signed up in the last `days` days, and how far each got (through a workspace they own). */
export async function signupFunnel(q: Q, days: number): Promise<{ visits: number; steps: FunnelStep[] }> {
  const r = (
    await q.query(
      `with c as (select u.id, u.last_sign_in_at, u.email_verified_at from auth.users u where u.created_at > now() - make_interval(days => $1::int)),
       own as (select m.user_id, m.workspace_id from public.memberships m join c on c.id = m.user_id)
       select
         (select count(*) from c) as signed_up,
         (select count(*) from c where c.email_verified_at is not null or c.last_sign_in_at is not null) as verified,
         (select count(distinct user_id) from own) as workspace,
         (select count(distinct o.user_id) from own o where exists (select 1 from public.leads l where l.workspace_id = o.workspace_id)) as lead,
         (select count(distinct o.user_id) from own o where exists (select 1 from public.briefs b where b.workspace_id = o.workspace_id)) as research,
         (select count(distinct o.user_id) from own o where exists (select 1 from public.contacts ct where ct.workspace_id = o.workspace_id)) as email,
         (select count(distinct o.user_id) from own o where exists (select 1 from public.sending_accounts s where s.workspace_id = o.workspace_id)) as mailbox,
         (select count(distinct o.user_id) from own o where exists (select 1 from public.campaigns cp where cp.workspace_id = o.workspace_id and cp.status <> 'draft')) as campaign,
         (select count(distinct o.user_id) from own o where exists (select 1 from public.messages ms where ms.workspace_id = o.workspace_id and ms.direction = 'inbound')) as reply,
         (select count(distinct o.user_id) from own o join public.workspaces w on w.id = o.workspace_id where w.plan = 'paid') as paid,
         (select coalesce(sum(visits), 0) from app.site_visits where day > (now() at time zone 'utc')::date - $1::int) as visits`,
      [days],
    )
  ).rows[0] as Record<string, unknown>;
  const steps: [string, string][] = [
    ["signed_up", "Signed up"],
    ["verified", "Confirmed email / signed in"],
    ["workspace", "Created or joined a workspace"],
    ["lead", "Saved a lead"],
    ["research", "Researched a website"],
    ["email", "Has a lead with an email"],
    ["mailbox", "Connected Gmail"],
    ["campaign", "Launched a campaign"],
    ["reply", "Got a reply"],
    ["paid", "On a paid plan"],
  ];
  return { visits: n(r.visits), steps: steps.map(([key, label]) => ({ key, label, count: n(r[key]) })) };
}

export type SourceRow = { source: string; visits: number; signups: number; activated: number; paid: number };

/** Sign-ups by first-visit source in the last `days` days, next to anonymous first visits from the same source. */
export async function sources(q: Q, days: number): Promise<SourceRow[]> {
  return (
    await q.query<SourceRow>(
      `with s as (
         select coalesce(a.source, 'unknown') as source, u.id
         from auth.users u left join app.signup_attribution a on a.user_id = u.id
         where u.created_at > now() - make_interval(days => $1::int)
       ), v as (
         select source, sum(visits)::int as visits from app.site_visits where day > (now() at time zone 'utc')::date - $1::int group by source
       ), k as (select source from s union select source from v)
       select k.source,
         coalesce((select v.visits from v where v.source = k.source), 0)::int as visits,
         (select count(*) from s where s.source = k.source)::int as signups,
         (select count(*) from s where s.source = k.source and exists (
            select 1 from public.memberships m join public.campaigns cp on cp.workspace_id = m.workspace_id
            where m.user_id = s.id and cp.status <> 'draft'))::int as activated,
         (select count(*) from s where s.source = k.source and exists (
            select 1 from public.memberships m join public.workspaces w on w.id = m.workspace_id
            where m.user_id = s.id and w.plan = 'paid'))::int as paid
       from k order by signups desc, visits desc limit 50`,
      [days],
    )
  ).rows;
}

/** Campaign links (utm_campaign) that brought sign-ups. */
export async function campaignsBySignups(q: Q, days: number) {
  return (
    await q.query<{ campaign: string; source: string; signups: number }>(
      `select a.campaign, a.source, count(*)::int as signups from app.signup_attribution a join auth.users u on u.id = a.user_id
       where a.campaign is not null and u.created_at > now() - make_interval(days => $1::int)
       group by a.campaign, a.source order by signups desc limit 20`,
      [days],
    )
  ).rows;
}

export type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  method: "google" | "password";
  verified: boolean;
  source: string | null;
  campaign: string | null;
  workspaces: number;
  workspace_name: string | null;
  role: string | null;
  plan: Plan | null;
};

export async function users(q: Q, search: string, limit = 200): Promise<UserRow[]> {
  return (
    await q.query<UserRow>(
      `select u.id, u.email, nullif(u.raw_user_meta_data ->> 'full_name', '') as name, u.created_at, u.last_sign_in_at,
         case when u.auth_subject like 'google:%' then 'google' else 'password' end as method,
         (u.email_verified_at is not null) as verified,
         a.source, a.campaign,
         (select count(*)::int from public.memberships m where m.user_id = u.id) as workspaces,
         fw.name as workspace_name, fw.role, fw.plan
       from auth.users u
       left join app.signup_attribution a on a.user_id = u.id
       left join lateral (
         select w.name, m.role, w.plan from public.memberships m join public.workspaces w on w.id = m.workspace_id
         where m.user_id = u.id order by (m.role = 'owner') desc, m.created_at limit 1
       ) fw on true
       where $1 = '' or u.email ilike '%' || $1 || '%' or u.raw_user_meta_data ->> 'full_name' ilike '%' || $1 || '%'
       order by u.created_at desc limit $2`,
      [search, limit],
    )
  ).rows;
}

export type WorkspaceRow = {
  id: string;
  name: string;
  created_at: string;
  owner_email: string | null;
  plan: Plan;
  trial_ends_at: string;
  trial_days_left: number;
  plan_note: string | null;
  members: number;
  leads: number;
  sent: number;
  mailboxes: number;
  last_active: string | null;
};

export async function workspaces(q: Q, trialDays: number, search: string, limit = 200): Promise<WorkspaceRow[]> {
  return (
    await q.query<WorkspaceRow>(
      `select w.id, w.name, w.created_at, w.plan, ${TRIAL_END("$1")} as trial_ends_at, w.plan_note,
         ceil(extract(epoch from (${TRIAL_END("$1")} - now())) / 86400)::int as trial_days_left,
         (select u.email from public.memberships m join auth.users u on u.id = m.user_id where m.workspace_id = w.id and m.role = 'owner' limit 1) as owner_email,
         (select count(*)::int from public.memberships m where m.workspace_id = w.id) as members,
         (select count(*)::int from public.leads l where l.workspace_id = w.id) as leads,
         (select count(*)::int from public.dispatches x where x.workspace_id = w.id and x.status = 'accepted') as sent,
         (select count(*)::int from public.sending_accounts s where s.workspace_id = w.id and s.status = 'connected') as mailboxes,
         greatest(
           (select max(created_at) from public.leads l where l.workspace_id = w.id),
           (select max(created_at) from public.discovery_jobs j where j.workspace_id = w.id),
           (select max(attempted_at) from public.dispatches x where x.workspace_id = w.id)) as last_active
       from public.workspaces w
       where $2 = '' or w.name ilike '%' || $2 || '%'
         or exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id where m.workspace_id = w.id and u.email ilike '%' || $2 || '%')
       order by w.created_at desc limit $3`,
      [trialDays, search, limit],
    )
  ).rows;
}

/** Outreach across the platform. */
export async function emailStats(q: Q, days: number) {
  const r = (
    await q.query(
      `select
         (select count(*) from public.dispatches where status = 'accepted' and accepted_at > now() - make_interval(days => $1::int)) as sent,
         (select count(*) from public.dispatches where status = 'accepted' and step > 0 and accepted_at > now() - make_interval(days => $1::int)) as followups,
         (select count(*) from public.dispatches where status in ('failed', 'ambiguous') and attempted_at > now() - make_interval(days => $1::int)) as failed,
         (select count(*) from public.messages where direction = 'inbound' and occurred_at > now() - make_interval(days => $1::int)) as replies,
         (select count(*) from public.threads where classification = 'interested' and last_inbound_at > now() - make_interval(days => $1::int)) as interested,
         (select count(*) from public.threads where classification = 'bounce' and last_inbound_at > now() - make_interval(days => $1::int)) as bounces,
         (select count(*) from public.suppression_entries where reason = 'unsubscribe' and created_at > now() - make_interval(days => $1::int)) as unsubscribes,
         (select count(*) from public.sending_accounts where status = 'connected') as mailboxes,
         (select count(*) from public.sending_accounts where status = 'needs_reconnect') as reconnect,
         (select count(*) from public.campaigns where status = 'running') as running`,
      [days],
    )
  ).rows[0] as Record<string, unknown>;
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, n(v)])) as Record<
    "sent" | "followups" | "failed" | "replies" | "interested" | "bounces" | "unsubscribes" | "mailboxes" | "reconnect" | "running",
    number
  >;
}

/** Mailboxes that need their owner's attention. */
export async function mailboxProblems(q: Q) {
  return (
    await q.query<{ email: string; workspace: string; status: string; last_error: string | null }>(
      `select s.email, w.name as workspace, s.status, s.last_error from public.sending_accounts s join public.workspaces w on w.id = s.workspace_id
       where s.status <> 'connected' order by s.created_at desc limit 50`,
    )
  ).rows;
}

/** Shared keys: Google Places calls per day, built-in AI units, and personal agent (MCP) tokens. */
export async function sharedApis(q: Q, days: number) {
  const places = (
    await q.query<{ day: string; calls: number }>(
      `with d as (select generate_series((now() at time zone 'utc')::date - ($1::int - 1), (now() at time zone 'utc')::date, interval '1 day')::date as day)
       select to_char(d.day, 'YYYY-MM-DD') as day, coalesce((select calls from app.provider_daily_calls p where p.provider = 'google_places' and p.day = d.day), 0)::int as calls
       from d order by d.day`,
      [days],
    )
  ).rows;
  const ai = (
    await q.query<{ day: string; units: number }>(
      `with d as (select generate_series((now() at time zone 'utc')::date - ($1::int - 1), (now() at time zone 'utc')::date, interval '1 day')::date as day)
       select to_char(d.day, 'YYYY-MM-DD') as day,
         coalesce((select sum(units) from public.usage_ledger l where l.kind = 'ai' and l.entry_type = 'charge' and (l.created_at at time zone 'utc')::date = d.day), 0)::int as units
       from d order by d.day`,
      [days],
    )
  ).rows;
  const t = (
    await q.query(
      `select count(*) filter (where revoked_at is null) as active,
              count(*) filter (where revoked_at is null and last_used_at > now() - interval '7 days') as used7,
              count(distinct workspace_id) filter (where revoked_at is null) as workspaces
       from public.api_tokens`,
    )
  ).rows[0] as Record<string, unknown>;
  const recentTokens = (
    await q.query<{ name: string; prefix: string; workspace: string; email: string | null; last_used_at: string | null; created_at: string }>(
      `select t.name, t.prefix, w.name as workspace, u.email, t.last_used_at, t.created_at
       from public.api_tokens t join public.workspaces w on w.id = t.workspace_id left join auth.users u on u.id = t.user_id
       where t.revoked_at is null order by t.last_used_at desc nulls last, t.created_at desc limit 20`,
    )
  ).rows;
  const topAi = (
    await q.query<{ workspace: string; units: number }>(
      `select w.name as workspace, sum(l.units)::int as units from public.usage_ledger l join public.workspaces w on w.id = l.workspace_id
       where l.kind = 'ai' and l.entry_type = 'charge' and l.created_at > now() - make_interval(days => $1::int)
       group by w.name order by units desc limit 10`,
      [days],
    )
  ).rows;
  return { places, ai, tokens: { active: n(t.active), used7: n(t.used7), workspaces: n(t.workspaces) }, recentTokens, topAi };
}

export async function auditLog(q: Q, limit = 50) {
  return (await q.query<{ id: string; admin_email: string; action: string; target: string | null; details: Record<string, unknown>; created_at: string }>("select * from app.admin_audit order by created_at desc limit $1", [limit])).rows;
}

export async function accountsFor(q: Q, emails: string[]) {
  if (!emails.length) return [];
  return (await q.query<{ email: string; last_sign_in_at: string | null }>("select lower(email) as email, last_sign_in_at from auth.users where lower(email) = any($1::text[])", [emails])).rows;
}

/** Sets a workspace's plan by hand (until billing exists) and records who did it. */
export async function setPlan(q: Q, adminEmail: string, workspaceId: string, p: { plan: Plan; trialEndsAt: string | null; note: string | null }): Promise<boolean> {
  const before = (await q.query<{ name: string; plan: string; trial_ends_at: string | null }>("select name, plan, trial_ends_at from public.workspaces where id = $1", [workspaceId])).rows[0];
  if (!before) return false;
  await q.query("update public.workspaces set plan = $2, trial_ends_at = $3, plan_note = $4, plan_updated_at = now() where id = $1", [workspaceId, p.plan, p.trialEndsAt, p.note]);
  await q.query("insert into app.admin_audit (admin_email, action, target, details) values ($1, 'set_plan', $2, $3::jsonb)", [
    adminEmail,
    before.name,
    JSON.stringify({ workspaceId, from: before.plan, to: p.plan, trialEndsAt: p.trialEndsAt, note: p.note }),
  ]);
  return true;
}
