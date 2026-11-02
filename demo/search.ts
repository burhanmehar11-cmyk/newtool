import type { Business, DiscoveryFilters } from "@/lib/domain/types";
import { businesses } from "./fixtures/businesses";

export const PAGE_SIZE = 10;

/** Demo discovery over fixtures. Same filter semantics the M2 provider adapter must honour. */
export function searchFixtures(f: DiscoveryFilters): Business[] {
  return businesses
    .filter((b) => (f.niche ? b.niche === f.niche : true))
    .filter((b) => (f.city ? b.city === f.city : true))
    .filter((b) => (f.radiusMi ? b.distanceMi <= f.radiusMi : true))
    .filter((b) => (f.minRating ? (b.rating ?? 0) >= f.minRating : true))
    .filter((b) => (f.minReviews ? (b.reviewCount ?? 0) >= f.minReviews : true))
    .filter((b) => (f.website === "has" ? !!b.website : f.website === "none" ? !b.website : true))
    .slice(0, f.maxResults);
}

export function canSearch(f: DiscoveryFilters): { ok: true } | { ok: false; reason: string } {
  if (!f.niche) return { ok: false, reason: "Choose a business type." };
  if (!f.city) return { ok: false, reason: "Choose a city with sample data." };
  return { ok: true };
}

/** Upper bound charged for a search: one discovery unit per business returned. */
export function estimateMaxUnits(f: DiscoveryFilters) {
  return f.maxResults;
}
