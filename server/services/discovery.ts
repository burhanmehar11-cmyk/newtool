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
import { GOOGLE_PROVIDER, MIN_RATINGS, PLACE_ID, type GooglePlace } from "@/lib/discovery/google-places";
import { isCountryCode, placeLabel } from "@/lib/geo/regions";

/** Maps free text like "dentists" or "Dental clinics" to a preset business type, when one fits. */
export function matchNiche(text: string): string | null {
  const t = text.trim().toLowerCase();
  const n = discoveryNiches.find((x) => [x.id, x.label, x.singular, x.plural].some((v) => v.toLowerCase() === t));
  return n?.id ?? null;
}
import {
  createJob,
  finishJob,
  getJob,
  jobResults,
  listLeads,
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
export async function reserveDiscovery(userId: string, workspaceId: string, jobId: string, units: number) {
  try {
    await asQ(userId, (q) => reserve(q, workspaceId, jobId, units));
  } catch (e) {
    if (!String((e as Error).message).includes("quota_exceeded") || billingConfig().enforce) throw e;
    await withService((q) =>
      q.query(
        "update public.workspace_allowances set units = greatest(units, app.committed_units($1, 'discovery') + $2) where workspace_id = $1 and kind = 'discovery'",
        [workspaceId, units],
      ),
    );
    await asQ(userId, (q) => reserve(q, workspaceId, jobId, units));
  }
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
    await reserveDiscovery(user.id, workspace.id, jobId, f.maxResults);
  } catch (e) {
    const quota = String((e as Error).message).includes("quota_exceeded");
    await asQ(user.id, (q) => finishJob(q, jobId, "failed", 0, quota ? "Not enough discovery units left." : "Couldn't reserve usage."));
    return { ok: false, jobId, error: quota ? "This search could use more discovery units than you have left. Lower the maximum results." : "Couldn't start the search. Try again." };
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
type FoundEmail = EmailLookup["emails"][number];
export type GoogleSearchOutcome =
  | { ok: true; jobId: string; query: string; niche: string | null; results: GoogleResult[]; filteredOut: number; requests: number; scanned: number; noWebsite: number; noEmail: number; noPhone: number; fewReviews: number; closed: number }
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

  const jobId = await asQ(user.id, (q) => createJob(q, workspace.id, user.id, query, f, GOOGLE_PROVIDER));
  try {
    await reserveDiscovery(user.id, workspace.id, jobId, f.maxResults);
  } catch (e) {
    const quota = String((e as Error).message).includes("quota_exceeded");
    await asQ(user.id, (q) => finishJob(q, jobId, "failed", 0, quota ? "Not enough discovery units left." : "Couldn't reserve usage."));
    return { ok: false, error: quota ? "This search could use more discovery units than you have left. Lower the maximum results." : "Couldn't start the search. Try again." };
  }

  // Cheap filters first (open, reviews, phone, website), then each remaining
  // website is read for a public email. Next page of 20 (up to 3 pages) until
  // there are enough. People are charged only for the businesses returned.
  const target = f.maxResults;
  const results: GoogleResult[] = [];
  const seen = new Set<string>();
  let token: string | null = null;
  let requests = 0;
  let scanned = 0;
  let noWebsite = 0;
  let noEmail = 0;
  let noPhone = 0;
  let fewReviews = 0;
  let closed = 0;
  let lastError: string | null = null;
  for (let page = 0; page < 3 && results.length < target; page++) {
    const r = await searchPage({ query, pageToken: token, minRating: f.minRating, regionCode: f.country });
    if (!r.ok) {
      lastError = r.error.message;
      break;
    }
    requests++;
    const fresh = r.value.places.filter((p) => p.status !== "CLOSED_PERMANENTLY" && !seen.has(p.placeId));
    fresh.forEach((p) => seen.add(p.placeId));
    scanned += fresh.length;
    const candidates = fresh.filter((p) => {
      if (f.openOnly && p.status === "CLOSED_TEMPORARILY") return void closed++, false;
      if (f.minReviews && (p.ratingCount ?? 0) < f.minReviews) return void fewReviews++, false;
      if (f.requirePhone && !p.phone) return void noPhone++, false;
      if ((f.requireEmail || f.requireWebsite) && !p.website) return void noWebsite++, false;
      return true;
    });
    const lookups = await pool(candidates, 20, async (p) => {
      if (!p.website) return null;
      const l = await findEmailsOnWebsite(p.website, { budgetMs: 7_000 }).catch(() => null);
      // Keep only addresses whose domain can actually receive email (free DNS check).
      return l ? { ...l, emails: await deliverableEmails(l.emails) } : null;
    });
    candidates.forEach((p, i) => {
      const l = lookups[i];
      const emails = l?.emails ?? [];
      if (f.requireEmail && !emails.length) return void noEmail++;
      results.push({ ...p, saved: false, emails, siteName: l?.siteName ?? null });
    });
    token = r.value.nextPageToken;
    if (!token) break;
  }
  if (!requests) {
    await asQ(user.id, async (q) => {
      await settle(q, workspace.id, jobId, 0);
      await finishJob(q, jobId, "failed", 0, lastError ?? "Search failed.");
    });
    return { ok: false, error: lastError ?? "Couldn't search Google Maps. Try again." };
  }
  const kept = results.slice(0, target);
  const saved = new Set(await asQ(user.id, (q) => savedPlaceIds(q, workspace.id, kept.map((p) => p.placeId))));
  await asQ(user.id, async (q) => {
    await settle(q, workspace.id, jobId, kept.length);
    await finishJob(q, jobId, "completed", kept.length, null);
  });
  return {
    ok: true,
    jobId,
    query,
    niche: f.niche,
    results: kept.map((p) => ({ ...p, saved: saved.has(p.placeId) })),
    filteredOut: noWebsite + noEmail + noPhone + fewReviews + closed,
    requests,
    scanned,
    noWebsite,
    noEmail,
    noPhone,
    fewReviews,
    closed,
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
