/**
 * Pure helpers for OpenStreetMap discovery (Nominatim for places, Overpass
 * for businesses). No network code here, so they're unit-testable.
 *
 * Data © OpenStreetMap contributors, available under the ODbL. Show
 * attribution wherever results are displayed.
 */

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";

export type GeoPoint = { lat: number; lon: number; label: string };

export type OsmBusiness = {
  ref: string; // "osm:node/123"
  name: string;
  category: string;
  address: string | null;
  city: string | null;
  region: string | null;
  phone: string | null;
  website: string | null;
  domain: string | null;
  email: string | null;
  lat: number;
  lon: number;
  distanceKm: number;
  sourceUrl: string; // OSM page for this object
  excerpt: string; // captured tags, shown as evidence
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Overpass QL: every selector within the radius, named objects only, centres for ways/relations. */
export function buildOverpassQuery(p: { selectors: string[]; lat: number; lon: number; radiusKm: number; limit: number }): string {
  const r = Math.round(Math.min(Math.max(p.radiusKm, 0.5), 50) * 1000);
  const lat = p.lat.toFixed(6);
  const lon = p.lon.toFixed(6);
  const parts = p.selectors.map((s) => `  nwr${s}["name"](around:${r},${lat},${lon});`).join("\n");
  return `[out:json][timeout:25];\n(\n${parts}\n);\nout center tags ${Math.min(Math.max(p.limit, 1), 500)};`;
}

export function parseNominatim(json: unknown): GeoPoint | null {
  const first = Array.isArray(json) ? (json[0] as { lat?: string; lon?: string; display_name?: string } | undefined) : undefined;
  if (!first?.lat || !first.lon) return null;
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, label: String(first.display_name ?? "").slice(0, 200) };
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function normalizeWebsite(raw: string | undefined): { website: string; domain: string } | null {
  if (!raw) return null;
  const v = raw.trim().split(/[;\s]/)[0];
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return { website: u.toString(), domain: u.hostname.toLowerCase().replace(/^www\./, "") };
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^@\s;,]+@[^@\s;,]+\.[a-z]{2,}$/i;

function firstEmail(raw: string | undefined): string | null {
  if (!raw) return null;
  const e = raw.split(/[;,\s]/).map((x) => x.trim().replace(/^mailto:/i, "")).find((x) => EMAIL_RE.test(x));
  return e ? e.toLowerCase() : null;
}

const CATEGORY_KEYS = ["amenity", "healthcare", "craft", "office", "shop", "leisure"];

/** Turns an Overpass response into deduplicated, distance-sorted businesses. */
export function parseOverpass(
  json: unknown,
  ctx: { center: { lat: number; lon: number }; website: "any" | "has" | "none"; limit: number },
): OsmBusiness[] {
  const elements = ((json as { elements?: OverpassElement[] })?.elements ?? []).filter((e) => e && e.tags?.name);
  const seen = new Set<string>();
  const out: OsmBusiness[] = [];
  for (const e of elements) {
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const ref = `osm:${e.type}/${e.id}`;
    if (seen.has(ref)) continue;
    seen.add(ref);
    const t = e.tags!;
    const site = normalizeWebsite(t.website ?? t["contact:website"] ?? t.url);
    if (ctx.website === "has" && !site) continue;
    if (ctx.website === "none" && site) continue;
    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    const city = t["addr:city"] ?? null;
    const region = t["addr:state"] ?? t["addr:province"] ?? null;
    const address = [street, city, [region, t["addr:postcode"]].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
    const catKey = CATEGORY_KEYS.find((k) => t[k]);
    const keep = ["name", "website", "contact:website", "phone", "contact:phone", "email", "contact:email", "opening_hours", "addr:street", "addr:city", ...CATEGORY_KEYS];
    out.push({
      ref,
      name: t.name.slice(0, 200),
      category: catKey ? `${catKey}=${t[catKey]}` : "business",
      address,
      city,
      region,
      phone: (t.phone ?? t["contact:phone"] ?? "").split(";")[0].trim() || null,
      website: site?.website ?? null,
      domain: site?.domain ?? null,
      email: firstEmail(t.email ?? t["contact:email"]),
      lat,
      lon,
      distanceKm: Math.round(haversineKm(ctx.center, { lat, lon }) * 10) / 10,
      sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      excerpt: keep
        .filter((k) => t[k])
        .map((k) => `${k}=${t[k]}`)
        .join("\n")
        .slice(0, 2000),
    });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, ctx.limit);
}
