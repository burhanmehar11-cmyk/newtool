import type { Business, BusinessSignals, Contact, EmailStatus, Evidence, NicheId, OpportunityBrief } from "@/lib/domain/types";
import type { Q } from "@/server/auth-store";

/**
 * Research and email-check persistence. Runs on a user-scoped connection, so
 * row-level security limits everything to the caller's workspaces.
 */

type BizRow = {
  id: string;
  workspace_id: string;
  name: string;
  niche: string | null;
  category: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  phone: string | null;
  website: string | null;
  domain_normalized: string | null;
  provider: string;
  provider_ref: string;
  collected_at: string;
  researched_at: string | null;
  research_status: string | null;
  research_note: string | null;
  signals: BusinessSignals | null;
};

type EvidenceRow = { id: string; kind: Evidence["kind"] | "other"; label: string; url: string; excerpt: string; collected_at: string };
type ContactRow = { id: string; email_normalized: string; kind: "role" | "named"; status: EmailStatus; verified_at: string | null; verification_provider: string | null; verification_detail: string | null; source_evidence_id: string | null };

export type LeadDetail = {
  leadId: string;
  notes: string;
  savedAt: string;
  business: BizRow;
  evidence: EvidenceRow[];
  contacts: ContactRow[];
  brief: OpportunityBrief | null;
};

const EMPTY_SIGNALS: BusinessSignals = {
  siteCopyrightYear: null,
  mobileViewport: null,
  onlineBooking: null,
  intakeMethod: null,
  ownerReplyShare: null,
  hoursListed: null,
  photoCount: null,
  contactForm: null,
};

export async function leadDetail(q: Q, leadId: string): Promise<LeadDetail | null> {
  const lead = (
    await q.query<{ id: string; notes: string; created_at: string; business_id: string }>("select id, notes, created_at, business_id from public.leads where id = $1", [leadId])
  ).rows[0];
  if (!lead) return null;
  const business = (await q.query<BizRow>("select * from public.businesses where id = $1", [lead.business_id])).rows[0];
  if (!business) return null;
  const [evidence, contacts, brief] = await Promise.all([
    q.query<EvidenceRow>("select id, kind, label, url, excerpt, collected_at from public.evidence where business_id = $1 order by collected_at desc", [business.id]),
    q.query<ContactRow>(
      "select id, email_normalized, kind, status, verified_at, verification_provider, verification_detail, source_evidence_id from public.contacts where business_id = $1 order by created_at",
      [business.id],
    ),
    q.query<{ payload: OpportunityBrief; offer_type: string }>("select payload, offer_type from public.briefs where business_id = $1 order by created_at desc limit 1", [business.id]),
  ]);
  const b = brief.rows[0];
  return {
    leadId: lead.id,
    notes: lead.notes,
    savedAt: lead.created_at,
    business,
    evidence: evidence.rows,
    contacts: contacts.rows,
    brief: b ? { ...b.payload, offerType: b.offer_type as OpportunityBrief["offerType"] } : null,
  };
}

/** Builds the domain object the brief rules work on, from the newest evidence of each kind. */
export function toBusiness(d: LeadDetail, extraEvidence: Evidence[] = [], signals?: BusinessSignals): Business {
  const newest = new Map<string, EvidenceRow>();
  for (const e of d.evidence) if (!newest.has(e.kind)) newest.set(e.kind, e);
  const stored: Evidence[] = [...newest.values()]
    .filter((e) => e.kind !== "other" && !extraEvidence.some((x) => x.kind === e.kind))
    .map((e) => ({ id: e.id, businessId: d.business.id, kind: e.kind as Evidence["kind"], label: e.label, url: e.url, collectedAt: e.collected_at, excerpt: e.excerpt }));
  return {
    id: d.business.id,
    name: d.business.name,
    niche: (d.business.niche ?? "dental") as NicheId,
    city: d.business.city ?? "",
    region: d.business.region ?? "",
    address: d.business.address ?? "",
    phone: d.business.phone ?? "",
    website: d.business.website,
    domain: d.business.domain_normalized,
    rating: null,
    reviewCount: null,
    distanceMi: 0,
    provider: { name: "OpenStreetMap", ref: d.business.provider_ref },
    collectedAt: d.business.collected_at,
    signals: signals ?? d.business.signals ?? EMPTY_SIGNALS,
    evidence: [...extraEvidence, ...stored],
    contacts: [] as Contact[],
  };
}

export type ResearchOutcome = {
  status: "ok" | "partial" | "no_website" | "blocked" | "failed";
  note: string;
  signals: BusinessSignals;
  evidence: Evidence[];
  emails: { email: string; kind: "role" | "named" }[];
  /** The name the website gives itself, from the homepage. */
  siteName?: string | null;
};

/** Stores new evidence, signals, any emails found on the site, and the brief built from them. */
export async function saveResearch(q: Q, ws: string, businessId: string, r: ResearchOutcome, brief: OpportunityBrief, offerType: string) {
  for (const e of r.evidence) {
    await q.query(
      "insert into public.evidence (id, workspace_id, business_id, kind, label, url, excerpt, collected_at) values ($1, $2, $3, $4, $5, $6, $7, $8)",
      [e.id, ws, businessId, e.kind, e.label.slice(0, 200), e.url, e.excerpt.slice(0, 4000), e.collectedAt],
    );
  }
  const source = r.evidence.find((e) => e.kind === "contact_page") ?? r.evidence.find((e) => e.kind === "homepage");
  for (const c of r.emails) {
    await q.query(
      "insert into public.contacts (workspace_id, business_id, email_normalized, kind, source_evidence_id) values ($1, $2, $3, $4, $5) on conflict (workspace_id, email_normalized) do nothing",
      [ws, businessId, c.email, c.kind, source?.id ?? null],
    );
  }
  await q.query(
    "update public.businesses set signals = $2::jsonb, researched_at = now(), research_status = $3, research_note = $4 where id = $1",
    [businessId, JSON.stringify(r.signals), r.status, r.note.slice(0, 1000)],
  );
  // Google Maps leads start named after their domain (Google's names can't be stored);
  // use the name the business's own website gives.
  if (r.siteName) {
    await q.query("update public.businesses set name = $2 where id = $1 and provider = 'google_places'", [businessId, r.siteName.slice(0, 120)]);
  }
  await q.query("insert into public.briefs (workspace_id, business_id, offer_type, payload, generator) values ($1, $2, $3, $4::jsonb, 'template')", [ws, businessId, offerType, JSON.stringify(brief)]);
}

/**
 * Records a free DNS check. Never overwrites a "valid" (or other) result from
 * a real verification provider with a weaker DNS-only answer.
 */
export async function recordDnsCheck(q: Q, contactId: string, status: "invalid" | "unknown", detail: string): Promise<boolean> {
  const r = await q.query<{ id: string }>(
    `update public.contacts set status = $2, verified_at = now(), verification_provider = 'dns-check', verification_detail = $3
     where id = $1 and (status in ('unverified', 'unknown', 'invalid') and coalesce(verification_provider, 'dns-check') = 'dns-check')
     returning id`,
    [contactId, status, detail.slice(0, 300)],
  );
  return r.rows.length > 0;
}

export async function contactById(q: Q, contactId: string) {
  return (await q.query<{ id: string; email_normalized: string; business_id: string }>("select id, email_normalized, business_id from public.contacts where id = $1", [contactId])).rows[0] ?? null;
}

export async function saveNotes(q: Q, leadId: string, notes: string) {
  const r = await q.query<{ id: string }>("update public.leads set notes = $2 where id = $1 returning id", [leadId, notes.slice(0, 5000)]);
  return r.rows.length > 0;
}
