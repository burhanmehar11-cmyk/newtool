import "server-only";
import { z } from "zod";
import { discoveryNiches, nicheLabel } from "@/lib/discovery/niches";
import { requireWorkspace } from "@/server/auth";
import { withUser } from "@/server/db";
import type { Q } from "@/server/auth-store";
import { geocode, searchBusinesses } from "@/server/providers/osm";
import {
  createJob,
  finishJob,
  getJob,
  jobResults,
  listLeads,
  persistResults,
  recentJobs,
  reserve,
  saveLeads,
  settle,
  type SearchFilters,
} from "@/server/discovery-store";

export const searchSchema = z.object({
  niche: z.enum(discoveryNiches.map((n) => n.id) as [string, ...string[]]),
  place: z.string().trim().min(2, "Enter a city or area, like “Austin, TX”.").max(100),
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
export async function runSearch(input: unknown): Promise<SearchOutcome> {
  const { user, workspace } = await requireWorkspace("/app/discover");
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const f = parsed.data as SearchFilters;
  const query = `${nicheLabel(f.niche)} near ${f.place}`;

  const jobId = await asQ(user.id, (q) => createJob(q, workspace.id, user.id, query, f));
  try {
    await asQ(user.id, (q) => reserve(q, workspace.id, jobId, f.maxResults));
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
    await persistResults(q, workspace.id, jobId, found.value);
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
  const parsed = z.array(z.string().uuid()).min(1).max(100).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Select at least one business." };
  return { ok: true, added: await asQ(user.id, (q) => saveLeads(q, workspace.id, user.id, parsed.data)) };
}

export async function getLeads() {
  const { user, workspace } = await requireWorkspace("/app/leads");
  return asQ(user.id, (q) => listLeads(q, workspace.id));
}
