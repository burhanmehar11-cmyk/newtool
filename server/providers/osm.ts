import "server-only";
import { brand } from "@/config/brand";
import { buildOverpassQuery, parseNominatim, parseOverpass, type GeoPoint, type OsmBusiness } from "@/lib/discovery/osm";
import { configuredSiteUrl } from "@/server/env";
import type { ProviderError, Result } from "./types";

/**
 * OpenStreetMap discovery: Nominatim (place search) + Overpass (businesses).
 * Free public services with fair-use policies: identify the app with a real
 * User-Agent and contact, keep request volume low, cache place lookups.
 *   https://operations.osmfoundation.org/policies/nominatim/
 *   https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
 * Self-hosted or commercial instances can be used via NOMINATIM_URL / OVERPASS_URL.
 */

const NOMINATIM = process.env.NOMINATIM_URL?.trim() || "https://nominatim.openstreetmap.org";
/**
 * Public Overpass instances, tried in order. The main instance increasingly
 * answers automated requests with 406 or 429, so a busy or refusing instance
 * falls through to the next. OVERPASS_URL (comma-separated) overrides the list.
 */
export const OVERPASS_URLS = (process.env.OVERPASS_URL?.trim() || "https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

function userAgent() {
  const contact = process.env.OSM_CONTACT_EMAIL?.trim() || brand.supportEmail;
  return `${brand.name}/0.1 (+${configuredSiteUrl() ?? brand.siteUrl}; ${contact})`;
}

const err = (code: ProviderError["code"], message: string, retryable: boolean): { ok: false; error: ProviderError } => ({
  ok: false,
  error: { code, message, retryable, provider: "openstreetmap" },
});

const geoCache = new Map<string, { at: number; value: GeoPoint }>();

export async function geocode(place: string): Promise<Result<GeoPoint>> {
  const key = place.trim().toLowerCase();
  const hit = geoCache.get(key);
  if (hit && Date.now() - hit.at < 24 * 3600_000) return { ok: true, value: hit.value };
  const url = new URL("/search", NOMINATIM);
  url.searchParams.set("q", place.trim());
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  try {
    const res = await fetch(url, { headers: { "user-agent": userAgent(), accept: "application/json" }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (res.status === 429) return err("rate_limited", "The place lookup service is busy. Try again in a minute.", true);
    if (!res.ok) return err("upstream_error", `Place lookup failed (HTTP ${res.status}).`, true);
    const point = parseNominatim(await res.json());
    if (!point) return err("invalid_request", `Couldn't find “${place}”. Try a city and region, like “Austin, TX”.`, false);
    if (geoCache.size > 500) geoCache.clear();
    geoCache.set(key, { at: Date.now(), value: point });
    return { ok: true, value: point };
  } catch (e) {
    return (e as Error)?.name === "TimeoutError" ? err("timeout", "The place lookup timed out. Try again.", true) : err("upstream_error", "Couldn't reach the place lookup service.", true);
  }
}

export async function searchBusinesses(p: {
  selectors: string[];
  center: GeoPoint;
  radiusKm: number;
  website: "any" | "has" | "none";
  limit: number;
}): Promise<Result<OsmBusiness[]>> {
  // Ask for extra when filtering by website, since filtering happens after the query.
  const query = buildOverpassQuery({ selectors: p.selectors, lat: p.center.lat, lon: p.center.lon, radiusKm: p.radiusKm, limit: p.website === "any" ? p.limit * 2 : p.limit * 4 });
  const deadline = Date.now() + 45_000;
  let last: { ok: false; error: ProviderError } = err("upstream_error", "Couldn't reach the map data service.", true);
  for (const endpoint of OVERPASS_URLS) {
    const left = deadline - Date.now();
    if (left < 5_000) break;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "user-agent": userAgent(),
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json, text/plain, */*",
          referer: configuredSiteUrl() ?? brand.siteUrl,
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(Math.min(30_000, left)),
        cache: "no-store",
      });
      if (res.ok) {
        const json: unknown = await res.json().catch(() => null);
        if (json) return { ok: true, value: parseOverpass(json, { center: p.center, website: p.website, limit: p.limit }) };
        last = err("upstream_error", "The map data service sent an unreadable answer.", true);
        continue;
      }
      // 406/429/5xx: this instance refused or is overloaded; try the next one.
      last =
        res.status === 429
          ? err("rate_limited", "The map data services are busy right now. Try again in a minute.", true)
          : res.status === 504
            ? err("timeout", "The map data service took too long. Try a smaller radius.", true)
            : err("upstream_error", `Map data search failed (HTTP ${res.status}). Try again in a few minutes.`, true);
      if (res.status === 400) return last; // our query is wrong; another instance won't help
    } catch (e) {
      last = (e as Error)?.name === "TimeoutError" ? err("timeout", "The map data search timed out. Try a smaller radius.", true) : err("upstream_error", "Couldn't reach the map data service.", true);
    }
  }
  return last;
}
