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
const OVERPASS = process.env.OVERPASS_URL?.trim() || "https://overpass-api.de/api/interpreter";

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
  try {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "user-agent": userAgent(), "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (res.status === 429) return err("rate_limited", "The map data service is busy right now. Try again in a minute.", true);
    if (res.status === 504) return err("timeout", "The map data service took too long. Try a smaller radius.", true);
    if (!res.ok) return err("upstream_error", `Map data search failed (HTTP ${res.status}).`, true);
    return { ok: true, value: parseOverpass(await res.json(), { center: p.center, website: p.website, limit: p.limit }) };
  } catch (e) {
    return (e as Error)?.name === "TimeoutError" ? err("timeout", "The map data search timed out. Try a smaller radius.", true) : err("upstream_error", "Couldn't reach the map data service.", true);
  }
}
