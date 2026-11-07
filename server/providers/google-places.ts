import "server-only";
import { buildTextSearchBody, parseGoogleError, parsePlace, parseTextSearch, PLACE_ID, TEXT_SEARCH_FIELD_MASK, type Box, type GooglePlace } from "@/lib/discovery/google-places";
import { withService } from "@/server/db";
import type { ProviderError, Result } from "./types";

/**
 * Google Places API (New). Server-side only: the key never reaches the browser.
 *   Text Search:   POST https://places.googleapis.com/v1/places:searchText
 *   Place Details: GET  https://places.googleapis.com/v1/places/{placeId}
 *
 * Every call is counted per day (for the admin panel). By default Locenti adds
 * no cap of its own: Google's per-day quota on the project is the limit. Set
 * GOOGLE_PLACES_DAILY_LIMIT to add a Locenti-side cap as well.
 */

const BASE = "https://places.googleapis.com/v1";
const PROVIDER = "google_places";

export function placesApiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || null;
}

export function googlePlacesConfigured() {
  return !!placesApiKey();
}

/** Locenti's own daily cap, or null for none (the default: Google's quota decides). */
export function dailyLimit(): number | null {
  const raw = process.env.GOOGLE_PLACES_DAILY_LIMIT?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : null;
}

const err = (code: ProviderError["code"], message: string, retryable: boolean): { ok: false; error: ProviderError } => ({
  ok: false,
  error: { code, message, retryable, provider: PROVIDER },
});

/** SQL for the daily counter, shared with the database tests. Returns a row only if a slot was free. */
export const TAKE_SLOT_SQL = `insert into app.provider_daily_calls (provider, day, calls) values ($1, (now() at time zone 'utc')::date, 1)
  on conflict (provider, day) do update set calls = app.provider_daily_calls.calls + 1
  where app.provider_daily_calls.calls < $2
  returning calls`;

/** Counts a call without any cap. */
export const COUNT_CALL_SQL = `insert into app.provider_daily_calls (provider, day, calls) values ($1, (now() at time zone 'utc')::date, 1)
  on conflict (provider, day) do update set calls = app.provider_daily_calls.calls + 1`;

/** Takes `n` slots from today's limit (UTC day), all or nothing. */
async function takeSlots(n: number): Promise<boolean> {
  const limit = dailyLimit();
  if (limit === null) {
    // No Locenti cap: just count, and never block a search on the counter.
    await withService(async (q) => {
      for (let i = 0; i < n; i++) await q.query(COUNT_CALL_SQL, [PROVIDER]);
    }).catch(() => undefined);
    return true;
  }
  if (n > limit) return false;
  try {
    return await withService(async (q) => {
      for (let i = 0; i < n; i++) {
        const r = await q.query(TAKE_SLOT_SQL, [PROVIDER, limit]);
        if (!r.rows.length) throw new Error("daily_limit");
      }
      return true;
    });
  } catch (e) {
    if ((e as Error).message === "daily_limit") return false;
    throw e;
  }
}

/** Calls left today under Locenti's own cap, or null when there is none. */
export async function remainingToday(): Promise<number | null> {
  const limit = dailyLimit();
  if (limit === null) return null;
  const r = await withService((q) =>
    q.query<{ calls: number }>("select calls from app.provider_daily_calls where provider = $1 and day = (now() at time zone 'utc')::date", [PROVIDER]),
  );
  return Math.max(0, limit - (r.rows[0]?.calls ?? 0));
}

async function call(url: string, init: RequestInit & { fieldMask: string }): Promise<Result<unknown>> {
  const key = placesApiKey();
  if (!key) return err("not_configured", "Google Maps search isn't set up. Add GOOGLE_PLACES_API_KEY on the server.", false);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", "x-goog-api-key": key, "x-goog-fieldmask": init.fieldMask },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (e) {
    return (e as Error).name === "TimeoutError" ? err("timeout", "Google Maps took too long to answer. Try again.", true) : err("upstream_error", "Couldn't reach Google Maps.", true);
  }
  const json: unknown = await res.json().catch(() => null);
  if (res.ok) return { ok: true, value: json };
  const g = parseGoogleError(json);
  if (res.status === 429 || g.status === "RESOURCE_EXHAUSTED")
    return err("quota_exceeded", "Google's daily limit for Maps searches is reached for now. Try again later, or use OpenStreetMap search.", false);
  if (res.status === 403 || res.status === 401 || g.status === "PERMISSION_DENIED")
    return err("unauthorized", "Google rejected the API key. Check that Places API (New) is enabled and the key is allowed to use it.", false);
  if (res.status === 400) return err("invalid_request", "Google couldn't use this search. Try different words.", false);
  return err("upstream_error", `Google Maps returned an error (HTTP ${res.status}).`, res.status >= 500);
}

/** One page of Text Search (up to 20 places, one API request). For display only; never stored. */
export async function searchPage(p: { query: string; pageToken?: string | null; minRating?: number | null; regionCode?: string | null; box?: Box | null }): Promise<Result<{ places: GooglePlace[]; nextPageToken: string | null }>> {
  if (!placesApiKey()) return err("not_configured", "Google Maps search isn't set up. Add GOOGLE_PLACES_API_KEY on the server.", false);
  if (!(await takeSlots(1))) return err("quota_exceeded", `Today's Google Maps limit (${dailyLimit()} searches) is used up. It resets at midnight UTC. OpenStreetMap search still works.`, false);
  const r = await call(`${BASE}/places:searchText`, {
    method: "POST",
    fieldMask: TEXT_SEARCH_FIELD_MASK,
    body: JSON.stringify(buildTextSearchBody({ query: p.query, pageToken: p.pageToken ?? null, minRating: p.minRating, regionCode: p.regionCode, box: p.box ?? null })),
  });
  if (!r.ok) return r;
  const parsed = parseTextSearch(r.value);
  return { ok: true, value: { places: parsed.places, nextPageToken: parsed.nextPageToken } };
}

/**
 * Up to `maxResults` places (pages of 20; one API request per page). Results
 * are returned for display only and must not be stored.
 */
export async function textSearch(p: { query: string; maxResults: number; minRating?: number | null; regionCode?: string | null }): Promise<Result<{ places: GooglePlace[]; requests: number }>> {
  if (!placesApiKey()) return err("not_configured", "Google Maps search isn't set up. Add GOOGLE_PLACES_API_KEY on the server.", false);
  const pages = Math.max(1, Math.ceil(p.maxResults / 20));
  const places: GooglePlace[] = [];
  let token: string | null = null;
  let requests = 0;
  for (let i = 0; i < pages; i++) {
    if (!(await takeSlots(1))) {
      if (requests) break; // keep what we already have
      return err("quota_exceeded", `Today's Google Maps limit (${dailyLimit()} searches) is used up. It resets at midnight UTC. OpenStreetMap search still works.`, false);
    }
    requests++;
    const r = await call(`${BASE}/places:searchText`, {
      method: "POST",
      fieldMask: TEXT_SEARCH_FIELD_MASK,
      body: JSON.stringify(buildTextSearchBody({ query: p.query, pageToken: token, minRating: p.minRating, regionCode: p.regionCode })),
    });
    if (!r.ok) {
      if (places.length) break;
      return r;
    }
    const parsed = parseTextSearch(r.value);
    places.push(...parsed.places);
    token = parsed.nextPageToken;
    if (!token) break;
  }
  const seen = new Set<string>();
  return { ok: true, value: { places: places.filter((x) => !seen.has(x.placeId) && seen.add(x.placeId)).slice(0, p.maxResults), requests } };
}

export type PlaceDetails = GooglePlace & { hours: string[] };

const DETAILS_FIELD_MASK = "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,rating,userRatingCount,businessStatus,primaryTypeDisplayName,regularOpeningHours.weekdayDescriptions";

/** Live details for one place, for display only (not stored). Uses one daily slot. */
export async function placeDetails(placeId: string): Promise<Result<PlaceDetails>> {
  if (!PLACE_ID.test(placeId)) return err("invalid_request", "Not a Google place ID.", false);
  if (!placesApiKey()) return err("not_configured", "Google Maps isn't set up on this server.", false);
  if (!(await takeSlots(1))) return err("quota_exceeded", `Today's Google Maps limit (${dailyLimit()} requests) is used up. It resets at midnight UTC.`, false);
  const r = await call(`${BASE}/places/${encodeURIComponent(placeId)}`, { method: "GET", fieldMask: DETAILS_FIELD_MASK });
  if (!r.ok) return r;
  const place = parsePlace(r.value);
  if (!place) return err("upstream_error", "Google returned an unexpected answer.", true);
  const hours = (r.value as { regularOpeningHours?: { weekdayDescriptions?: unknown } }).regularOpeningHours?.weekdayDescriptions;
  return { ok: true, value: { ...place, hours: Array.isArray(hours) ? hours.filter((h): h is string => typeof h === "string").slice(0, 7) : [] } };
}
