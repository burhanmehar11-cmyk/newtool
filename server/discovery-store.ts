import type { OsmBusiness } from "@/lib/discovery/osm";
import { normalizeWebsite, OSM_ATTRIBUTION } from "@/lib/discovery/osm";
import { GOOGLE_PROVIDER, PLACE_ID } from "@/lib/discovery/google-places";
import { storeFoundEmails, type StoredEmail } from "@/server/email-store";
import { businessEmails } from "@/lib/research/extract";

/** Keeps only emails that came from a page on the business's own site and pass the same rule the finder uses. */
export function trustedEmails(emails: StoredEmail[], domain: string): StoredEmail[] {
  const allowed = new Set(businessEmails(emails.map((e) => e.email.toLowerCase()), domain).map((e) => e.email));
  return emails
    .filter((e) => {
      try {
        const host = new URL(e.url).hostname.toLowerCase().replace(/^www\./, "");
        return allowed.has(e.email.toLowerCase()) && (host === domain || host.endsWith(`.${domain}`));
      } catch {
        return false;
      }
    })
    .slice(0, 5);
}
import type { Q } from "@/server/auth-store";

/**
 * Discovery persistence. Every function runs on a user-scoped connection
 * (role "authenticated" with app.user_id set), so row-level security limits
 * all reads and writes to the caller's workspaces. Shared with the database
 * tests, which run the same code against the real migrations.
 */

export const PROVIDER = "openstreetmap";

export type SearchFilters = { niche: string; place: string; radiusKm: number; website: "any" | "has" | "none"; maxResults: number };

export type GoogleSearchFilters = { source: "google"; niche: string | null; businessType: string; country: string | null; state: string | null; place: string; minRating: number; website: "any" | "has" | "none"; maxResults: number };

export async function createJob(q: Q, ws: string, userId: string, query: string, filters: SearchFilters | GoogleSearchFilters, provider: string = PROVIDER): Promise<string> {
  const r = await q.query<{ id: string }>(
    `insert into public.discovery_jobs (workspace_id, created_by, query, filters, provider, status, estimated_units, reservation_key)
     values ($1, $2, $3, $4::jsonb, $5, 'running', $6, null) returning id`,
    [ws, userId, query.slice(0, 300), JSON.stringify(filters), provider, filters.maxResults],
  );
  const id = r.rows[0].id;
  await q.query("update public.discovery_jobs set reservation_key = $2 where id = $1", [id, `discovery:${id}`]);
  return id;
}

/** Holds the maximum units before any provider call. Throws quota_exceeded when it doesn't fit. */
export async function reserve(q: Q, ws: string, jobId: string, units: number) {
  await q.query("select public.reserve_usage($1, 'discovery', $2, $3, $4)", [ws, units, `discovery:${jobId}`, "Search reservation"]);
}

/** Charges what was returned and releases the rest. Idempotent. */
export async function settle(q: Q, ws: string, jobId: string, used: number) {
  await q.query("select public.settle_usage($1, $2, $3, $4)", [ws, `discovery:${jobId}`, used, `Search returned ${used}`]);
}

export async function finishJob(q: Q, jobId: string, status: "completed" | "failed", charged: number, error: string | null) {
  await q.query("update public.discovery_jobs set status = $2, charged_units = $3, error = $4, finished_at = now() where id = $1", [jobId, status, charged, error]);
}

/** Upserts businesses (deduplicated per workspace and source record), records evidence and public emails, links results. */
export async function persistResults(q: Q, ws: string, jobId: string, results: OsmBusiness[], niche: string | null = null): Promise<string[]> {
  const ids: string[] = [];
  for (const [i, b] of results.entries()) {
    const biz = await q.query<{ id: string }>(
      `insert into public.businesses (workspace_id, provider, provider_ref, name, category, address, city, region, phone, website, domain_normalized, attribution, niche, collected_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
       on conflict (workspace_id, provider, provider_ref) do update set
         name = excluded.name, category = excluded.category, address = excluded.address, city = excluded.city, region = excluded.region,
         phone = excluded.phone, website = excluded.website, domain_normalized = excluded.domain_normalized,
         niche = coalesce(excluded.niche, businesses.niche), collected_at = now()
       returning id`,
      [ws, PROVIDER, b.ref, b.name, b.category, b.address, b.city, b.region, b.phone, b.website, b.domain, OSM_ATTRIBUTION, niche],
    );
    const businessId = biz.rows[0].id;
    ids.push(businessId);

    let evidenceId = (
      await q.query<{ id: string }>(
        `insert into public.evidence (workspace_id, business_id, kind, label, url, excerpt, collected_at)
         select $1, $2, 'listing', 'OpenStreetMap listing', $3, $4, now()
         where not exists (select 1 from public.evidence where business_id = $2 and url = $3 and excerpt = $4)
         returning id`,
        [ws, businessId, b.sourceUrl, b.excerpt],
      )
    ).rows[0]?.id;
    evidenceId ??= (await q.query<{ id: string }>("select id from public.evidence where business_id = $1 and url = $2 order by collected_at desc limit 1", [businessId, b.sourceUrl])).rows[0]?.id;

    if (b.email) {
      // Published on the public listing; starts unverified. Never overwrites an existing contact's status.
      await q.query(
        `insert into public.contacts (workspace_id, business_id, email_normalized, kind, source_evidence_id)
         values ($1, $2, $3, 'role', $4) on conflict (workspace_id, email_normalized) do nothing`,
        [ws, businessId, b.email, evidenceId ?? null],
      );
    }
    await q.query(
      "insert into public.discovery_results (workspace_id, job_id, business_id, position) values ($1, $2, $3, $4) on conflict do nothing",
      [ws, jobId, businessId, i],
    );
  }
  return ids;
}

export type ResultRow = {
  id: string;
  provider: string;
  provider_ref: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  email_status: string | null;
  source_url: string | null;
  saved: boolean;
};

const RESULT_COLUMNS = `b.id, b.provider, b.provider_ref, b.name, b.category, b.address, b.city, b.phone, b.website,
  c.email_normalized as email, c.status as email_status,
  (select e.url from public.evidence e where e.business_id = b.id order by e.collected_at desc limit 1) as source_url,
  exists (select 1 from public.leads l where l.business_id = b.id) as saved`;

export async function jobResults(q: Q, jobId: string): Promise<ResultRow[]> {
  return (
    await q.query<ResultRow>(
      `select ${RESULT_COLUMNS}
       from public.discovery_results r
       join public.businesses b on b.id = r.business_id
       left join lateral (select email_normalized, status from public.contacts where business_id = b.id order by created_at limit 1) c on true
       where r.job_id = $1 order by r.position`,
      [jobId],
    )
  ).rows;
}

export type JobRow = { id: string; provider: string; query: string; status: string; estimated_units: number; charged_units: number; error: string | null; created_at: string; filters: SearchFilters };

export async function getJob(q: Q, jobId: string): Promise<JobRow | null> {
  return (await q.query<JobRow>("select id, provider, query, status, estimated_units, charged_units, error, created_at, filters from public.discovery_jobs where id = $1", [jobId])).rows[0] ?? null;
}

export async function recentJobs(q: Q, ws: string, limit = 8): Promise<JobRow[]> {
  return (
    await q.query<JobRow>(
      "select id, provider, query, status, estimated_units, charged_units, error, created_at, filters from public.discovery_jobs where workspace_id = $1 order by created_at desc limit $2",
      [ws, limit],
    )
  ).rows;
}

/** Explicitly saves chosen businesses as leads. Already-saved ones are skipped. */
export async function saveLeads(q: Q, ws: string, userId: string, businessIds: string[]): Promise<number> {
  if (!businessIds.length) return 0;
  const r = await q.query<{ id: string }>(
    `insert into public.leads (workspace_id, business_id, source, saved_by)
     select $1, b.id, 'search', $2 from public.businesses b where b.workspace_id = $1 and b.id = any($3::uuid[])
     on conflict (workspace_id, business_id) do nothing returning id`,
    [ws, userId, businessIds],
  );
  return r.rows.length;
}

export type LeadRow = ResultRow & { lead_id: string; saved_at: string; researched_at: string | null; research_status: string | null; fit: string | null; niche: string | null };

export async function listLeads(q: Q, ws: string): Promise<LeadRow[]> {
  return (
    await q.query<LeadRow>(
      `select l.id as lead_id, l.created_at as saved_at, b.researched_at, b.research_status, b.niche,
         (select br.payload->'fit'->>'level' from public.briefs br where br.business_id = b.id order by br.created_at desc limit 1) as fit,
         ${RESULT_COLUMNS}
       from public.leads l join public.businesses b on b.id = l.business_id
       left join lateral (select email_normalized, status from public.contacts where business_id = b.id order by created_at limit 1) c on true
       where l.workspace_id = $1 order by l.created_at desc limit 500`,
      [ws],
    )
  ).rows;
}

export type GoogleSaveItem = { placeId: string; website: string; siteName?: string | null; emails?: { email: string; kind: "role" | "named"; url: string }[] };

/**
 * Saves Google Maps results as leads without copying Google content. Stored:
 * the place ID (allowed indefinitely) and the business's own website, which
 * research then reads. The name starts as the website's domain and is
 * replaced by the name the website gives itself once researched. No Google
 * name, address, phone, rating or review is stored.
 */
export async function saveGoogleLeads(q: Q, ws: string, userId: string, items: GoogleSaveItem[], niche: string | null): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;
  for (const it of items) {
    const site = normalizeWebsite(it.website);
    if (!PLACE_ID.test(it.placeId) || !site) {
      skipped++;
      continue;
    }
    const biz = await q.query<{ id: string }>(
      `insert into public.businesses (workspace_id, provider, provider_ref, name, website, domain_normalized, attribution, niche, collected_at)
       values ($1, $2, $3, $4, $5, $6, 'Found on Google Maps', $7, now())
       on conflict (workspace_id, provider, provider_ref) do update set website = excluded.website, domain_normalized = excluded.domain_normalized
       returning id`,
      [ws, GOOGLE_PROVIDER, it.placeId, it.siteName?.trim().slice(0, 120) || site.domain, site.website, site.domain, niche],
    );
    if (it.emails?.length) await storeFoundEmails(q, ws, biz.rows[0].id, trustedEmails(it.emails, site.domain));
    const lead = await q.query(
      `insert into public.leads (workspace_id, business_id, source, saved_by) values ($1, $2, 'search', $3)
       on conflict (workspace_id, business_id) do nothing returning id`,
      [ws, biz.rows[0].id, userId],
    );
    if (lead.rows.length) added++;
    else skipped++;
  }
  return { added, skipped };
}

/** Place IDs (from the given list) this workspace has already saved as leads. */
export async function savedPlaceIds(q: Q, ws: string, placeIds: string[]): Promise<string[]> {
  if (!placeIds.length) return [];
  const r = await q.query<{ provider_ref: string }>(
    `select b.provider_ref from public.businesses b join public.leads l on l.business_id = b.id
     where b.workspace_id = $1 and b.provider = $2 and b.provider_ref = any($3::text[])`,
    [ws, GOOGLE_PROVIDER, placeIds],
  );
  return r.rows.map((x) => x.provider_ref);
}
