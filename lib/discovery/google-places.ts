/**
 * Google Places API (New): Text Search request building and response parsing.
 * Pure functions, so they are unit-tested without network access.
 *
 * Endpoint: POST https://places.googleapis.com/v1/places:searchText
 * Headers:  X-Goog-Api-Key, X-Goog-FieldMask (required; billing follows the
 *           highest-tier field requested).
 *
 * Storage rules (Google Maps Platform Terms 3.2.3 and Service Specific Terms
 * §3, §14): results are shown live and not cached. Only the place ID may be
 * stored indefinitely. Business names, addresses and reviews must not be
 * copied and saved. Places content must not be used with a non-Google map.
 */

/**
 * Fields requested from Text Search. websiteUri, phone and rating put the
 * request in the "Text Search Enterprise" pricing tier (1,000 free requests
 * a month at the time of writing). Each request returns up to 20 places.
 */
export const TEXT_SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.primaryTypeDisplayName",
  // Where each place is: lets a search continue in smaller areas once Google's 60 are used.
  "places.location",
  "nextPageToken",
].join(",");

export const PAGE_SIZE = 20;
/** Text Search stops paginating after 60 results. */
export const MAX_RESULTS = 60;

export const MIN_RATINGS = [0, 3.5, 4, 4.5] as const;

export type TextSearchRequest = {
  textQuery: string;
  pageSize: number;
  pageToken?: string;
  minRating?: number;
  /** Two-letter country code: biases results to that country. */
  regionCode?: string;
  /** Only places inside this rectangle. */
  locationRestriction?: { rectangle: { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } } };
};

/** A map rectangle in degrees: south, west, north, east. */
export type Box = { s: number; w: number; n: number; e: number };

export function buildTextSearchBody(p: { query: string; pageToken?: string | null; minRating?: number | null; regionCode?: string | null; box?: Box | null }): TextSearchRequest {
  const body: TextSearchRequest = { textQuery: p.query.trim().slice(0, 200), pageSize: PAGE_SIZE };
  if (p.pageToken) body.pageToken = p.pageToken;
  if (p.box) body.locationRestriction = { rectangle: { low: { latitude: p.box.s, longitude: p.box.w }, high: { latitude: p.box.n, longitude: p.box.e } } };
  if (p.minRating && p.minRating > 0) body.minRating = p.minRating;
  if (p.regionCode && /^[A-Z]{2}$/.test(p.regionCode)) body.regionCode = p.regionCode;
  return body;
}

/**
 * A Google Maps result, held in memory only for display. Never persisted
 * (except placeId when the user saves a lead).
 */
export type GooglePlace = {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  ratingCount: number | null;
  category: string | null;
  status: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | null;
  /** Position, held in memory only (never stored). */
  lat?: number | null;
  lng?: number | null;
};

/** Grows a box to include a point (a search's covered area, built from its results). */
export function extendBox(box: Box | null, lat: number, lng: number): Box {
  return box ? { s: Math.min(box.s, lat), w: Math.min(box.w, lng), n: Math.max(box.n, lat), e: Math.max(box.e, lng) } : { s: lat, w: lng, n: lat, e: lng };
}

/**
 * Splits the area a search covered into size × size smaller rectangles, a
 * little larger than the results' spread (and at least ~4 km across), so each
 * can be searched for up to 60 more places.
 */
export function gridTiles(box: Box, size = 3): Box[] {
  const MIN = 0.04;
  const padLat = Math.max((box.n - box.s) * 0.1, (MIN - (box.n - box.s)) / 2, 0);
  const padLng = Math.max((box.e - box.w) * 0.1, (MIN - (box.e - box.w)) / 2, 0);
  const s = Math.max(-90, box.s - padLat);
  const n = Math.min(90, box.n + padLat);
  const w = Math.max(-180, box.w - padLng);
  const e = Math.min(180, box.e + padLng);
  const dLat = (n - s) / size;
  const dLng = (e - w) / size;
  const tiles: Box[] = [];
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) tiles.push({ s: s + i * dLat, n: s + (i + 1) * dLat, w: w + j * dLng, e: w + (j + 1) * dLng });
  return tiles;
}

/** Place IDs are URL-safe base64-like strings. */
export const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parsePlace(raw: unknown): GooglePlace | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const placeId = str(r.id);
  if (!placeId || !PLACE_ID.test(placeId)) return null;
  const display = r.displayName as { text?: unknown } | undefined;
  const type = r.primaryTypeDisplayName as { text?: unknown } | undefined;
  const website = str(r.websiteUri);
  const status = str(r.businessStatus);
  return {
    placeId,
    name: str(display?.text) ?? "Unnamed place",
    address: str(r.formattedAddress),
    phone: str(r.nationalPhoneNumber),
    website: website && /^https?:\/\//i.test(website) ? website : null,
    rating: num(r.rating),
    ratingCount: num(r.userRatingCount),
    category: str(type?.text),
    status: status === "OPERATIONAL" || status === "CLOSED_TEMPORARILY" || status === "CLOSED_PERMANENTLY" ? status : null,
    lat: num((r.location as { latitude?: unknown } | undefined)?.latitude),
    lng: num((r.location as { longitude?: unknown } | undefined)?.longitude),
  };
}

export function parseTextSearch(json: unknown): { places: GooglePlace[]; nextPageToken: string | null } {
  const j = (json ?? {}) as { places?: unknown; nextPageToken?: unknown };
  const places = Array.isArray(j.places) ? j.places.map(parsePlace).filter((p): p is GooglePlace => !!p) : [];
  return { places, nextPageToken: str(j.nextPageToken) };
}

/** Google's error body: { error: { code, message, status } }. */
export function parseGoogleError(json: unknown): { status: string | null; message: string | null } {
  const e = (json as { error?: { status?: unknown; message?: unknown } } | null)?.error;
  return { status: str(e?.status), message: str(e?.message) };
}

/**
 * Link to the place on Google Maps (Maps URLs). Built from the stored place ID
 * so no Google content needs to be kept.
 */
export function googleMapsLink(placeId: string, label: string) {
  const u = new URL("https://www.google.com/maps/search/");
  u.searchParams.set("api", "1");
  u.searchParams.set("query", label || "Google Maps");
  u.searchParams.set("query_place_id", placeId);
  return u.toString();
}

export const GOOGLE_PROVIDER = "google_places";
