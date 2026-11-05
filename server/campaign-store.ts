import type { Schedule } from "@/lib/campaigns/schedule";
import type { Q } from "@/server/auth-store";

/**
 * Campaign persistence, run as the signed-in user (RLS limits everything to
 * the workspace). Sending itself runs on the service connection (see
 * server/dispatch-store.ts).
 */

export type CampaignStatus = "draft" | "running" | "paused" | "completed" | "cancelled";
export type CampaignPolicy = { includeCatchAll: boolean; includeUnknown: boolean };

/** SQL fragment: true when the contact's address or domain is on the do-not-contact list. */
const SUPPRESSED = (contact: string) => `exists (
  select 1 from public.suppression_entries s where s.workspace_id = ${contact}.workspace_id and (
    (s.kind = 'email' and s.value = ${contact}.email_normalized) or
    (s.kind = 'domain' and (split_part(${contact}.email_normalized, '@', 2) = s.value or split_part(${contact}.email_normalized, '@', 2) like '%.' || s.value))))`;

export type EligibleLead = { lead_id: string; name: string; domain: string | null; email: string; contact_id: string; email_status: string };

/**
 * Leads that can join a campaign: researched (have a brief), with a public
 * address that isn't marked invalid, not on the do-not-contact list and not
 * already in an active campaign.
 */
export async function eligibleLeads(q: Q, ws: string): Promise<EligibleLead[]> {
  return (
    await q.query<EligibleLead>(
      `select l.id as lead_id, b.name, b.domain_normalized as domain, c.email_normalized as email, c.id as contact_id, c.status as email_status
       from public.leads l
       join public.businesses b on b.id = l.business_id
       join lateral (select * from public.contacts c where c.business_id = b.id and c.status <> 'invalid' order by c.created_at limit 1) c on true
       where l.workspace_id = $1
         and exists (select 1 from public.briefs br where br.business_id = b.id)
         and not ${SUPPRESSED("c")}
         and not exists (select 1 from public.enrollments e where e.contact_id = c.id and e.state in ('queued', 'sent'))
       order by l.created_at desc limit 300`,
      [ws],
    )
  ).rows;
}

export async function createCampaign(q: Q, ws: string, userId: string, p: { name: string; schedule: Schedule; mailboxId: string | null; leadIds: string[] }): Promise<string> {
  const c = await q.query<{ id: string }>(
    `insert into public.campaigns (workspace_id, name, status, sending_account_id, schedule, created_by) values ($1, $2, 'draft', $3, $4::jsonb, $5) returning id`,
    [ws, p.name, p.mailboxId, JSON.stringify(p.schedule), userId],
  );
  const id = c.rows[0].id;
  await q.query("insert into public.campaign_steps (workspace_id, campaign_id, position, kind) values ($1, $2, 0, 'initial')", [ws, id]);
  await q.query(
    `insert into public.campaign_recipients (workspace_id, campaign_id, lead_id)
     select $1, $2, l.id from public.leads l where l.workspace_id = $1 and l.id = any($3::uuid[]) on conflict do nothing`,
    [ws, id, p.leadIds],
  );
  return id;
}

export async function saveDraft(q: Q, ws: string, userId: string, leadId: string, d: { subject: string; body: string; factIds: string[]; origin: "generated" | "edited" | "ai" | "agent" }): Promise<{ id: string; version: number }> {
  const r = await q.query<{ id: string; version: number }>(
    `insert into public.drafts (workspace_id, lead_id, version, subject, body, fact_ids, origin, created_by)
     values ($1, $2, coalesce((select max(version) from public.drafts where lead_id = $2), 0) + 1, $3, $4, $5::jsonb, $6, $7)
     returning id, version`,
    [ws, leadId, d.subject, d.body, JSON.stringify(d.factIds), d.origin, userId],
  );
  return r.rows[0];
}

export type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  revision: number;
  schedule: Schedule;
  policy: CampaignPolicy;
  sending_account_id: string | null;
  created_at: string;
  launched_at: string | null;
};

const CAMPAIGN_COLS = "id, name, status, revision, schedule, policy, sending_account_id, created_at, launched_at";

export type CampaignListRow = CampaignRow & { recipients: number; sent: number; queued: number };

export async function listCampaigns(q: Q, ws: string): Promise<CampaignListRow[]> {
  return (
    await q.query<CampaignListRow>(
      `select ${CAMPAIGN_COLS.split(", ").map((c) => `c.${c}`).join(", ")},
         (select count(*)::int from public.campaign_recipients r where r.campaign_id = c.id) as recipients,
         (select count(*)::int from public.enrollments e where e.campaign_id = c.id and e.state in ('sent', 'replied')) as sent,
         (select count(*)::int from public.enrollments e where e.campaign_id = c.id and e.state = 'queued') as queued
       from public.campaigns c where c.workspace_id = $1 order by c.created_at desc limit 100`,
      [ws],
    )
  ).rows;
}

export async function getCampaign(q: Q, id: string): Promise<CampaignRow | null> {
  return (await q.query<CampaignRow>(`select ${CAMPAIGN_COLS} from public.campaigns where id = $1`, [id])).rows[0] ?? null;
}

export type RecipientRow = {
  lead_id: string;
  name: string;
  domain: string | null;
  email: string | null;
  contact_id: string | null;
  email_status: string | null;
  suppressed: boolean;
  has_brief: boolean;
  draft_id: string | null;
  draft_version: number | null;
  subject: string | null;
  body: string | null;
  draft_origin: string | null;
  enrollment_state: string | null;
  enrollment_reason: string | null;
  dispatch_status: string | null;
  dispatch_error: string | null;
  accepted_at: string | null;
};

export async function campaignRecipients(q: Q, campaignId: string): Promise<RecipientRow[]> {
  return (
    await q.query<RecipientRow>(
      `select l.id as lead_id, b.name, b.domain_normalized as domain,
         c.email_normalized as email, c.id as contact_id, c.status as email_status,
         coalesce(${SUPPRESSED("c")}, false) as suppressed,
         exists (select 1 from public.briefs br where br.business_id = b.id) as has_brief,
         d.id as draft_id, d.version as draft_version, d.subject, d.body, d.origin as draft_origin,
         e.state as enrollment_state, e.reason as enrollment_reason,
         x.status as dispatch_status, x.error as dispatch_error, x.accepted_at
       from public.campaign_recipients r
       join public.leads l on l.id = r.lead_id
       join public.businesses b on b.id = l.business_id
       left join lateral (select * from public.contacts c where c.business_id = b.id and c.status <> 'invalid' order by c.created_at limit 1) c on true
       left join public.enrollments e on e.campaign_id = r.campaign_id and e.lead_id = l.id
       left join lateral (
         select * from public.drafts d where d.lead_id = l.id and (e.draft_id is null or d.id = e.draft_id) order by d.version desc limit 1
       ) d on true
       left join public.dispatches x on x.enrollment_id = e.id and x.step = 0
       where r.campaign_id = $1
       order by b.name`,
      [campaignId],
    )
  ).rows;
}

/** Any change before launch bumps the revision, so an approval always matches what was reviewed. */
export async function bumpRevision(q: Q, campaignId: string) {
  await q.query("update public.campaigns set revision = revision + 1 where id = $1 and status = 'draft'", [campaignId]);
}

export async function updateCampaignSettings(q: Q, campaignId: string, p: { name: string; mailboxId: string | null; schedule: Schedule; policy: CampaignPolicy }) {
  const r = await q.query(
    `update public.campaigns set name = $2, sending_account_id = $3, schedule = $4::jsonb, policy = $5::jsonb, revision = revision + 1
     where id = $1 and status = 'draft' returning id`,
    [campaignId, p.name, p.mailboxId, JSON.stringify(p.schedule), JSON.stringify(p.policy)],
  );
  return r.rows.length > 0;
}

export async function removeRecipient(q: Q, campaignId: string, leadId: string) {
  const r = await q.query(
    `delete from public.campaign_recipients r using public.campaigns c
     where r.campaign_id = $1 and r.lead_id = $2 and c.id = r.campaign_id and c.status = 'draft' returning r.lead_id`,
    [campaignId, leadId],
  );
  if (r.rows.length) await bumpRevision(q, campaignId);
  return r.rows.length > 0;
}

/** Who will actually be sent to under the campaign's policy, and why others won't. */
export function classifyRecipient(r: Pick<RecipientRow, "email" | "email_status" | "suppressed" | "draft_id">, policy: CampaignPolicy): { send: true } | { send: false; reason: string } {
  if (!r.email) return { send: false, reason: "No email address" };
  if (r.suppressed) return { send: false, reason: "On the do-not-contact list" };
  if (!r.draft_id) return { send: false, reason: "No message yet" };
  const s = r.email_status ?? "unverified";
  if (s === "invalid") return { send: false, reason: "Address can't receive email" };
  if (s === "valid") return { send: true };
  if (s === "catch_all") return policy.includeCatchAll ? { send: true } : { send: false, reason: "Catch-all domain (not included)" };
  return policy.includeUnknown ? { send: true } : { send: false, reason: "Not verified (not included)" };
}

/**
 * Approves the exact revision reviewed: records recipients and draft versions,
 * creates enrollments, and starts the campaign. Throws when the campaign
 * changed since it was reviewed.
 */
export async function approveCampaign(q: Q, ws: string, userId: string, campaignId: string, revision: number): Promise<{ enrolled: number }> {
  const c = (await q.query<CampaignRow>(`select ${CAMPAIGN_COLS} from public.campaigns where id = $1 for update`, [campaignId])).rows[0];
  if (!c) throw new Error("not_found");
  if (c.status !== "draft") throw new Error("not_draft");
  if (c.revision !== revision) throw new Error("stale");
  if (!c.sending_account_id) throw new Error("no_mailbox");
  const box = (await q.query<{ status: string }>("select status from public.sending_accounts where id = $1", [c.sending_account_id])).rows[0];
  if (box?.status !== "connected") throw new Error("mailbox_not_connected");

  const rows = await campaignRecipients(q, campaignId);
  const chosen = rows.filter((r) => classifyRecipient(r, c.policy).send);
  if (!chosen.length) throw new Error("no_recipients");

  await q.query(
    "insert into public.approvals (workspace_id, campaign_id, revision, recipient_lead_ids, draft_versions, approved_by) values ($1, $2, $3, $4::uuid[], $5::jsonb, $6)",
    [ws, campaignId, revision, chosen.map((r) => r.lead_id), JSON.stringify(Object.fromEntries(chosen.map((r) => [r.lead_id, r.draft_version]))), userId],
  );
  let enrolled = 0;
  for (const r of chosen) {
    const e = await q.query(
      `insert into public.enrollments (workspace_id, campaign_id, lead_id, contact_id, email, draft_id, state, step, next_send_at)
       select $1, $2, $3, $4, $5, $6, 'queued', 0, now()
       where not exists (select 1 from public.enrollments x where x.contact_id = $4 and x.state in ('queued', 'sent'))
       on conflict (campaign_id, lead_id) do nothing returning id`,
      [ws, campaignId, r.lead_id, r.contact_id, r.email, r.draft_id],
    );
    enrolled += e.rows.length;
  }
  if (!enrolled) throw new Error("no_recipients");
  await q.query("update public.campaigns set status = 'running', launched_at = now() where id = $1", [campaignId]);
  return { enrolled };
}

export async function setCampaignStatus(q: Q, campaignId: string, from: CampaignStatus[], to: CampaignStatus) {
  const r = await q.query("update public.campaigns set status = $3 where id = $1 and status = any($2::text[]) returning id", [campaignId, from, to]);
  if (r.rows.length && to === "cancelled") {
    await q.query("update public.enrollments set state = 'stopped', reason = 'Campaign cancelled', updated_at = now() where campaign_id = $1 and state = 'queued'", [campaignId]);
  }
  return r.rows.length > 0;
}

/* ------------------------------------------------------- do-not-contact list */

export type SuppressionRow = { id: string; value: string; kind: "email" | "domain"; reason: string; created_at: string };

export async function listSuppressions(q: Q, ws: string): Promise<SuppressionRow[]> {
  return (await q.query<SuppressionRow>("select id, value, kind, reason, created_at from public.suppression_entries where workspace_id = $1 order by created_at desc limit 500", [ws])).rows;
}

export async function addSuppression(q: Q, ws: string, userId: string | null, value: string, kind: "email" | "domain", reason: "manual" | "unsubscribe") {
  await q.query(
    "insert into public.suppression_entries (workspace_id, value, kind, reason, created_by) values ($1, lower($2), $3, $4, $5) on conflict (workspace_id, value) do nothing",
    [ws, value, kind, reason, userId],
  );
  // Stop anything still waiting to go to this address.
  await q.query(
    `update public.enrollments set state = 'stopped', reason = 'On the do-not-contact list', updated_at = now()
     where workspace_id = $1 and state = 'queued' and (($3 = 'email' and email = lower($2)) or ($3 = 'domain' and (split_part(email, '@', 2) = lower($2) or split_part(email, '@', 2) like '%.' || lower($2))))`,
    [ws, value, kind],
  );
}

export async function removeSuppression(q: Q, id: string) {
  const r = await q.query("delete from public.suppression_entries where id = $1 and reason = 'manual' returning id", [id]);
  return r.rows.length > 0;
}
