import "server-only";
import { accessProblem, billingConfig } from "@/server/services/billing";
import { emitLeadsCreated } from "@/server/services/webhooks";
import { z } from "zod";
import { discoveryNiches, nicheLabel } from "@/lib/discovery/niches";
import { requireWorkspace, type WorkspaceRef, isViewer, VIEW_ONLY } from "@/server/auth";
import { withService, withUser } from "@/server/db";
import type { Q } from "@/server/auth-store";
import { geocode, searchBusinesses } from "@/server/providers/osm";
import { googlePlacesConfigured, placeDetails, remainingToday, searchPage } from "@/server/providers/google-places";
import { findEmailsOnWebsite, type EmailLookup } from "@/server/research/find-emails";
import { deliverableEmails } from "@/server/research/email-check";
import { extendBox, GOOGLE_PROVIDER, gridTiles, MIN_RATINGS, PLACE_ID, type Box, type GooglePlace } from "@/lib/discovery/google-places";
import { isCountryCode, placeLabel } from "@/lib/geo/regions";
import { isAdminEmail } from "@/lib/admin";
import { discoveryMonthlyLimit } from "@/server/env";

/** Maps free text like "dentists" or "Dental clinics" to a preset business type, when one fits. */
export function matchNiche(text: string): string | null {
  const t = text.trim().toLowerCase();
  const n = discoveryNiches.find((x) => [x.id, x.label, x.singular, x.plural].some((v) => v.toLowerCase() === t));
  return n?.id ?? null;
}
import {
  createJob,
  addToJob,
  finishJob,
  getJob,
  jobResults,
  listLeads,
  monthlyDiscoveryUse,
  persistResults,
  recentJobs,
  reserve,
  saveGoogleLeads,
  saveLeads,
  savedPlaceIds,
  settle,
  type GoogleSearchFilters,
  type SearchFilters,
} from "@/server/discovery-store";

export const searchSchema = z.object({
  niche: z.enum(discoveryNiches.map((n) => n.id) as [string, ...string[]]),
  place: z.string().trim().min(2, "Enter a city or area, like “Austin”.").max(100),
  country: z.string().trim().toUpperCase().refine((v) => !v || isCountryCode(v), "Choose a country.").optional(),
  state: z.string().trim().max(60).optional(),
  radiusKm: z.coerce.number().refine((v) => [2, 5, 10, 25].includes(v), "Choose a radius."),
  website: z.enum(["any", "has", "none"]),
  maxResults: z.coerce.number().refine((v) => [10, 25, 50].includes(v), "Choose a maximum."),
});

export type SearchOutcome = { ok: true; jobId: string; found: number } | { ok: false; error: string; jobId?: string; fieldErrors?: Record<string, string> };

const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));

/**
 * One bounded search: reserve the maximum, look up the place, query
 * OpenStreetMap, store results, then charge only what was returned. Failed
 * searches release the whole reservation.
 */
/**
 * Reserves discovery units for a search. While plan limits aren't enforced
 * (BILLING_ENFORCE off), a workspace that runs out is topped up instead of
 * blocked, so only Google's own quota limits searches; usage is still recorded.
 */
/** Monthly limit for this workspace, or null for none (paid and complimentary plans, and the platform owner's own workspace). */
async function monthlyLimitFor(workspaceId: string): Promise<number | null> {
  const limit = discoveryMonthlyLimit();
  if (limit === null) return null;
  const w = await withService((q) =>
    q.query<{ plan: string | null; owner: string | null }>(
      `select to_jsonb(w)->>'plan' as plan,
         (select u.email from public.memberships m join auth.users u on u.id = m.user_id where m.workspace_id = w.id and m.role = 'owner' limit 1) as owner
       from public.workspaces w where w.id = $1`,
      [workspaceId],
    ),
  );
  const row = w.rows[0];
  if (row && (row.plan === "paid" || row.plan === "comp" || isAdminEmail(row.owner))) return null;
  return limit;
}

/** First day of next month (UTC), when the monthly limit resets. */
export function monthlyResetDate(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** This month's allowance for a workspace: null limit means none. */
export async function monthlyDiscovery(userId: string, workspaceId: string): Promise<{ limit: number | null; used: number; left: number | null; resetsOn: string }> {
  const limit = await monthlyLimitFor(workspaceId);
  const used = limit === null ? 0 : await asQ(userId, (q) => monthlyDiscoveryUse(q, workspaceId));
  return { limit, used, left: limit === null ? null : Math.max(0, limit - used), resetsOn: monthlyResetDate().toISOString().slice(0, 10) };
}

/**
 * Reserves units for a search and returns how many it may use: fewer than
 * asked when the workspace's monthly limit (200 businesses by default) has
 * less left. Throws "monthly_limit" when none is left, and "quota_exceeded"
 * when billing is enforced and the plan's units are used up. Until billing is
 * enforced, the plan allowance is topped up instead of blocking.
 */
export async function reserveDiscovery(userId: string, workspaceId: string, jobId: string, units: number): Promise<number> {
  const limit = await monthlyLimitFor(workspaceId);
  if (!billingConfig().enforce) {
    await withService((q) =>
      q.query(
        "update public.workspace_allowances set units = greatest(units, app.committed_units($1, 'discovery') + $2) where workspace_id = $1 and kind = 'discovery'",
        [workspaceId, units],
      ),
    );
  }
  return asQ(userId, async (q) => {
    // One search at a time per workspace while the month's use is counted, so two searches can't both take the last units.
    await q.query("select pg_advisory_xact_lock(hashtext($1))", [`discovery-month:${workspaceId}`]);
    const n = limit === null ? units : Math.min(units, limit - (await monthlyDiscoveryUse(q, workspaceId)));
    if (n < 1) throw new Error("monthly_limit");
    await reserve(q, workspaceId, jobId, n);
    return n;
  });
}

/** What to tell someone when a search can't reserve units. */
async function reserveError(e: unknown, workspaceId: string): Promise<{ log: string; error: string }> {
  const msg = String((e as Error)?.message);
  if (msg.includes("monthly_limit")) {
    const limit = (await monthlyLimitFor(workspaceId)) ?? 0;
    const on = monthlyResetDate().toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
    return { log: "Monthly limit reached.", error: `You've used this month's ${limit} businesses. Google Maps search opens again on ${on}.` };
  }
  if (msg.includes("quota_exceeded")) return { log: "Not enough discovery units left.", error: "This search could use more discovery units than you have left. Lower the maximum results." };
  return { log: "Couldn't reserve usage.", error: "Couldn't start the search. Try again." };
}

export async function getMonthlyDiscovery() {
  const { user, workspace } = await requireWorkspace("/app/discover");
  return monthlyDiscovery(user.id, workspace.id);
}

export async function runSearch(input: unknown): Promise<SearchOutcome> {
  const { user, workspace } = await requireWorkspace("/app/discover");
  if (isViewer(workspace)) return { ok: false, error: VIEW_ONLY };
  {
    const why = await accessProblem(workspace.id);
    if (why) return { ok: false, error: why };
  }
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const { country, state, ...rest } = parsed.data;
  const f = { ...rest, place: placeLabel({ city: rest.place, state, country }) } as SearchFilters;
  const query = `${nicheLabel(f.niche)} near ${f.place}`;

  const jobId = await asQ(user.id, (q) => createJob(q, workspace.id, user.id, query, f));
  try {
    f.maxResults = await reserveDiscovery(user.id, workspace.id, jobId, f.maxResults);
  } catch (e) {
    const why = await reserveError(e, workspace.id);
    await asQ(user.id, (q) => finishJob(q, jobId, "failed", 0, why.log));
    return { ok: false, jobId, error: why.error };
  }

  const fail = async (message: string) => {
    await asQ(user.id, async (q) => {
      await settle(q, workspace.id, jobId, 0);
      await finishJob(q, jobId, "failed", 0, message);
    });
    return { ok: false as const, jobId, error: message };
  };

  const place = await geocode(f.place);
  if (!place.ok) return fail(place.error.message);
  const found = await searchBusinesses({
    selectors: discoveryNiches.find((n) => n.id === f.niche)!.osm,
    center: place.value,
    radiusKm: f.radiusKm,
    website: f.website,
    limit: f.maxResults,
  });
  if (!found.ok) return fail(found.error.message);

  await asQ(user.id, async (q) => {
    await persistResults(q, workspace.id, jobId, found.value, f.niche);
    await settle(q, workspace.id, jobId, found.value.length);
    await finishJob(q, jobId, "completed", found.value.length, null);
  });
  return { ok: true, jobId, found: found.value.length };
}

export async function getSearch(jobId: string) {
  const { user } = await requireWorkspace("/app/discover");
  if (!z.string().uuid().safeParse(jobId).success) return null;
  return asQ(user.id, async (q) => {
    const job = await getJob(q, jobId);
    return job ? { job, results: await jobResults(q, jobId) } : null;
  });
}

export async function getRecentSearches() {
  const { user, workspace } = await requireWorkspace("/app/discover");
  return asQ(user.id, (q) => recentJobs(q, workspace.id));
}

export async function saveSearchLeads(ids: unknown): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/discover");
  if (isViewer(workspace)) return { ok: false, error: VIEW_ONLY };
  const parsed = z.array(z.string().uuid()).min(1).max(100).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Select at least one business." };
  const since = new Date();
  const added = await asQ(user.id, (q) => saveLeads(q, workspace.id, user.id, parsed.data));
  if (added) await emitLeadsCreated(workspace.id, since);
  return { ok: true, added };
}

export async function getLeads() {
  const { user, workspace } = await requireWorkspace("/app/leads");
  return asQ(user.id, (q) => listLeads(q, workspace.id));
}

/* ------------------------------------------------------------ Google Maps */

const flag = z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean());

export const googleSearchSchema = z.object({
  // Any business type: free text, or a preset's id or label.
  businessType: z.string().trim().min(2, "Describe the type of business, like “dentists” or “wedding photographers”.").max(80),
  country: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => !v || isCountryCode(v), "Choose a country.")
    .optional(),
  state: z.string().trim().max(60).optional(),
  place: z.string().trim().min(2, "Enter a city or area, like “Austin”.").max(100),
  minRating: z.coerce.number().refine((v) => (MIN_RATINGS as readonly number[]).includes(v), "Choose a rating."),
  minReviews: z.coerce.number().refine((v) => [0, 10, 50, 100].includes(v), "Choose a number of reviews.").default(0),
  // Checkboxes: "on" when ticked (forms), or true/false (agents and the API).
  requireEmail: flag.default(true),
  requirePhone: flag.default(false),
  requireWebsite: flag.default(false),
  openOnly: flag.default(true),
  // Older callers: website "has" means requireWebsite.
  website: z.enum(["any", "has", "none"]).optional(),
  maxResults: z.coerce.number().refine((v) => [20, 40, 60].includes(v), "Choose a maximum."),
});

export type GoogleResult = GooglePlace & { saved: boolean; emails: FoundEmail[]; siteName: string | null };

/** Where a search goes on: the area it covered and the searches still to run (-1 = the search itself, 0–8 = grid areas). */
type QueueItem = { tile: number; token: string | null };
export type SearchCursor = { box: Box | null; queue: QueueItem[] };
/** Rounds after the first (each up to ~45 s). */
export const MAX_ROUNDS = 8;

const boxSchema = z.object({ s: z.number().min(-90).max(90), w: z.number().min(-180).max(180), n: z.number().min(-90).max(90), e: z.number().min(-180).max(180) });
const continuationSchema = z.object({
  jobId: z.string().uuid(),
  round: z.number().int().min(1).max(MAX_ROUNDS),
  found: z.number().int().min(0).max(60),
  seen: z.array(z.string().regex(PLACE_ID)).max(3000),
  cursor: z.object({ box: boxSchema.nullable(), queue: z.array(z.object({ tile: z.number().int().min(-1).max(8), token: z.string().max(2000).nullable() })).max(20) }),
});
type FoundEmail = EmailLookup["emails"][number];
export type GoogleSearchOutcome =
  | {
      ok: true;
      jobId: string;
      query: string;
      niche: string | null;
      results: GoogleResult[];
      /** Businesses with a website that showed no email we could find: shown (not charged) so nothing silently disappears. */
      withoutEmail: GoogleResult[];
      /** Set when there's more to search: pass it back (with the place ids seen) for the next round. */
      cursor: SearchCursor | null;
      /** Places checked in this round, so the next round skips them. */
      seenIds: string[];
      filteredOut: number; requests: number; scanned: number; noWebsite: number; noEmail: number; noPhone: number; fewReviews: number; closed: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function googleStatus() {
  if (!googlePlacesConfigured()) return { configured: false as const };
  return { configured: true as const, remainingToday: await remainingToday().catch(() => null) };
}

/**
 * Searches Google Maps live. Results go straight back to the browser and are
 * not stored (Google's terms forbid caching Places content). The job row keeps
 * only the query, filters and count, for usage and history.
 */
export type Ctx = { user: { id: string }; workspace: WorkspaceRef };

export async function runGoogleSearch(input: unknown): Promise<GoogleSearchOutcome> {
  return runGoogleSearchAs(await requireWorkspace("/app/discover"), input);
}

export async function runGoogleSearchAs({ user, workspace }: Ctx, input: unknown): Promise<GoogleSearchOutcome> {
  if (isViewer(workspace)) return { ok: false, error: VIEW_ONLY };
  {
    const why = await accessProblem(workspace.id);
    if (why) return { ok: false, error: why };
  }
  const parsed = googleSearchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const d = parsed.data;
  const preset = matchNiche(d.businessType);
  const f: GoogleSearchFilters = {
    source: "google",
    niche: preset,
    businessType: preset ? nicheLabel(preset) : d.businessType,
    country: d.country || null,
    state: d.state || null,
    place: d.place,
    minRating: d.minRating,
    minReviews: d.minReviews,
    requireEmail: d.requireEmail,
    requirePhone: d.requirePhone,
    requireWebsite: d.requireWebsite || d.website === "has",
    openOnly: d.openOnly,
    maxResults: d.maxResults,
  };
  const query = `${f.businessType} in ${placeLabel({ city: f.place, state: f.state, country: f.country })}`;

  // A continuation round goes on with the same search: same job, its own reservation.
  const cont = continuationSchema.safeParse((input as { continuation?: unknown } | null)?.continuation);
  const more = cont.success ? cont.data : null;
  let jobId: string;
  if (more) {
    const job = await asQ(user.id, (q) => getJob(q, more.jobId));
    if (!job || job.query !== query) return { ok: false, error: "That search can't be continued. Start a new one." };
    jobId = job.id;
  } else jobId = await asQ(user.id, (q) => createJob(q, workspace.id, user.id, query, f, GOOGLE_PROVIDER));
  const reservation = more ? `${jobId}:r${more.round}` : jobId;
  const wanted = Math.max(1, f.maxResults - (more?.found ?? 0));
  let allowed: number;
  try {
    allowed = await reserveDiscovery(user.id, workspace.id, reservation, wanted);
  } catch (e) {
    const why = await reserveError(e, workspace.id);
    if (!more) await asQ(user.id, (q) => finishJob(q, jobId, "failed", 0, why.log));
    return { ok: false, error: why.error };
  }

  // Google returns at most 60 places per search. Start with the search itself;
  // once its pages run out, search a 3 × 3 grid of smaller areas inside the area
  // it covered, each up to 60 more, skipping places already checked. Cheap
  // filters first (open, reviews, phone, website), then each website is read
  // for a public email. Each round stops starting new pages after ~36 s (the
  // browser asks for the next round); people are charged only for businesses
  // returned with an email.
  const started = Date.now();
  const target = allowed;
  const results: GoogleResult[] = [];
  const withoutEmail: GoogleResult[] = [];
  const seen = new Set<string>(more?.seen ?? []);
  const seenNow: string[] = [];
  const queue: QueueItem[] = more ? more.cursor.queue : [{ tile: -1, token: null }];
  let box: Box | null = more?.cursor.box ?? null;
  let requests = 0;
  let scanned = 0;
  let noWebsite = 0;
  let noEmail = 0;
  let noPhone = 0;
  let fewReviews = 0;
  let closed = 0;
  let lastError: string | null = null;
  while (queue.length && results.length < target && Date.now() - started < 36_000) {
    // The search itself page by page; area searches two at a time.
    const batch = queue[0].tile === -1 ? queue.splice(0, 1) : queue.splice(0, 2);
    const tiles = box ? gridTiles(box) : [];
    const pages = await Promise.all(
      batch.map((t) => searchPage({ query, pageToken: t.token, minRating: f.minRating, regionCode: f.country, box: t.tile >= 0 ? tiles[t.tile] : null })),
    );
    const fresh: GooglePlace[] = [];
    pages.forEach((r, k) => {
      const t = batch[k];
      if (!r.ok) {
        lastError = r.error.message;
        return;
      }
      requests++;
      for (const p of r.value.places) {
        if (t.tile === -1 && typeof p.lat === "number" && typeof p.lng === "number") box = extendBox(box, p.lat, p.lng);
        if (p.status === "CLOSED_PERMANENTLY" || seen.has(p.placeId)) continue;
        seen.add(p.placeId);
        seenNow.push(p.placeId);
        fresh.push(p);
      }
      if (r.value.nextPageToken) queue.push({ tile: t.tile, token: r.value.nextPageToken });
      // The search itself is used up: go on in smaller areas.
      else if (t.tile === -1 && box) queue.push(...gridTiles(box).map((_, i) => ({ tile: i, token: null })));
    });
    if (pages.every((r) => !r.ok)) break;
    scanned += fresh.length;
    const candidates = fresh.filter((p) => {
      if (f.openOnly && p.status === "CLOSED_TEMPORARILY") return void closed++, false;
      if (f.minReviews && (p.ratingCount ?? 0) < f.minReviews) return void fewReviews++, false;
      if (f.requirePhone && !p.phone) return void noPhone++, false;
      if ((f.requireEmail || f.requireWebsite) && !p.website) return void noWebsite++, false;
      return true;
    });
    const lookups = await pool(candidates, 40, async (p) => {
      if (!p.website) return null;
      const l = await findEmailsOnWebsite(p.website, { budgetMs: 10_000, businessName: p.name }).catch(() => null);
      // Keep only addresses whose domain can actually receive email (free DNS check).
      return l ? { ...l, emails: await deliverableEmails(l.emails) } : null;
    });
    candidates.forEach((p, i) => {
      const l = lookups[i];
      const emails = l?.emails ?? [];
      const row = { ...p, lat: undefined, lng: undefined, saved: false, emails, siteName: l?.siteName ?? null };
      if (f.requireEmail && !emails.length) {
        noEmail++;
        withoutEmail.push(row);
        return;
      }
      results.push(row);
    });
  }
  if (!requests) {
    await asQ(user.id, async (q) => {
      await settle(q, workspace.id, reservation, 0);
      if (!more) await finishJob(q, jobId, "failed", 0, lastError ?? "Search failed.");
    });
    return { ok: false, error: lastError ?? "Couldn't search Google Maps. Try again." };
  }
  const kept = results.slice(0, target);
  const extra = withoutEmail.slice(0, 60);
  const saved = new Set(await asQ(user.id, (q) => savedPlaceIds(q, workspace.id, [...kept, ...extra].map((p) => p.placeId))));
  await asQ(user.id, async (q) => {
    await settle(q, workspace.id, reservation, kept.length);
    if (more) await addToJob(q, jobId, kept.length);
    else await finishJob(q, jobId, "completed", kept.length, null);
  });
  // More to search, and the person still wants (and has units for) more.
  const cursor = queue.length && kept.length < wanted && allowed === wanted && (more?.round ?? 0) < MAX_ROUNDS ? { box, queue: queue.slice(0, 20) } : null;
  return {
    ok: true,
    jobId,
    query,
    niche: f.niche,
    results: kept.map((p) => ({ ...p, saved: saved.has(p.placeId) })),
    withoutEmail: extra.map((p) => ({ ...p, saved: saved.has(p.placeId) })),
    filteredOut: noWebsite + noEmail + noPhone + fewReviews + closed,
    requests,
    scanned,
    noWebsite,
    noEmail,
    noPhone,
    fewReviews,
    closed,
    cursor,
    seenIds: seenNow,
  };
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

const googleSaveSchema = z.object({
  niche: z.string().max(40).nullable(),
  items: z
    .array(
      z.object({
        placeId: z.string().regex(PLACE_ID),
        website: z.string().url().max(500),
        siteName: z.string().max(120).nullish(),
        // Emails found on the business's own website (from the live lookup), with the page they were on.
        emails: z.array(z.object({ email: z.string().email().max(254), kind: z.enum(["role", "named"]), url: z.string().url().max(500) })).max(5).optional(),
      }),
    )
    .min(1)
    .max(60),
});

export async function saveGoogleSearchLeads(input: unknown): Promise<{ ok: true; added: number; skipped: number } | { ok: false; error: string }> {
  return saveGoogleSearchLeadsAs(await requireWorkspace("/app/discover"), input);
}

export async function saveGoogleSearchLeadsAs({ user, workspace }: Ctx, input: unknown): Promise<{ ok: true; added: number; skipped: number } | { ok: false; error: string }> {
  if (isViewer(workspace)) return { ok: false, error: VIEW_ONLY };
  const parsed = googleSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Select at least one business that has a website." };
  const niche = parsed.data.niche && discoveryNiches.some((n) => n.id === parsed.data.niche) ? parsed.data.niche : null;
  const since = new Date();
  const r = await asQ(user.id, (q) => saveGoogleLeads(q, workspace.id, user.id, parsed.data.items, niche));
  if (r.added) await emitLeadsCreated(workspace.id, since);
  return { ok: true, ...r };
}

/** Live Google Maps details for a saved lead. Displayed, never stored. */
export async function getGooglePlaceDetails(placeId: string) {
  await requireWorkspace("/app/leads");
  const r = await placeDetails(placeId);
  return r.ok ? { ok: true as const, details: r.value } : { ok: false as const, error: r.error.message };
}
