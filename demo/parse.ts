import type { DiscoveryFilters, NicheId } from "@/lib/domain/types";
import { cities, niches } from "./fixtures/catalog";

/**
 * Demo query parser: turns a plain-English request into structured, editable
 * filters. Rule-based and local. Nothing is sent anywhere. The parsed
 * filters are always shown to the user before a search runs.
 */
export type ParseResult = {
  filters: DiscoveryFilters;
  /** Parts of the query that were not understood, so the UI can say so. */
  unrecognized: string[];
  /** City text that was found but has no sample data. */
  unsupportedCity: string | null;
};

export const DEFAULT_FILTERS: DiscoveryFilters = {
  niche: null,
  city: null,
  radiusMi: null,
  minRating: null,
  minReviews: null,
  website: "any",
  maxResults: 25,
};

export function parseQuery(input: string): ParseResult {
  const q = ` ${input.toLowerCase().replace(/[,;!?]/g, " ").replace(/(?<!\d)\.|\.(?!\d)/g, " ").replace(/\s+/g, " ")} `;
  const filters: DiscoveryFilters = { ...DEFAULT_FILTERS };
  let consumed = q;
  const eat = (re: RegExp) => {
    consumed = consumed.replace(re, " ");
  };

  // Niche: longest synonym wins.
  let best: { id: NicheId; syn: string } | null = null;
  for (const n of niches) {
    for (const syn of n.synonyms) {
      if (q.includes(` ${syn} `) || q.includes(` ${syn}s `)) {
        if (!best || syn.length > best.syn.length) best = { id: n.id, syn };
      }
    }
  }
  if (best) {
    filters.niche = best.id;
    eat(new RegExp(` ${escape(best.syn)}s? `, "g"));
    eat(/ (clinics?|companies|company|businesses|contractors?|firms?|offices?) /g);
  }

  // City
  let unsupportedCity: string | null = null;
  const cityMatch = cities.find((c) => c.aliases.some((a) => q.includes(` ${a} `)));
  if (cityMatch) {
    filters.city = cityMatch.city;
    for (const a of cityMatch.aliases) eat(new RegExp(` ${escape(a)} `, "g"));
  } else {
    const m = q.match(/ (?:in|near|around) ([a-z][a-z ]{1,30}?)(?= with| within| that| who| having| rated| and| \d|$| $)/);
    if (m) {
      unsupportedCity = m[1].trim().replace(/\b\w/g, (ch) => ch.toUpperCase());
      eat(new RegExp(` ${escape(m[1].trim())} `));
    }
  }

  const reviews = q.match(/(\d{1,5})\s*\+?\s*(?:or more )?reviews?/);
  if (reviews) {
    filters.minReviews = Number(reviews[1]);
    eat(/(at least |over |more than )?\d{1,5}\s*\+?\s*(or more )?reviews?/g);
  }

  const rating = q.match(/(\d(?:\.\d)?)\s*\+?\s*(?:stars?|star rating|rating)/) ?? q.match(/rat(?:ed|ing)\s*(?:of\s*)?(\d(?:\.\d)?)\s*\+?/);
  if (rating) {
    const r = Number(rating[1]);
    if (r >= 1 && r <= 5) filters.minRating = r;
    eat(/(rated |rating of )?\d(\.\d)?\s*\+?\s*(stars?|star rating|rating)?(?= )/);
  }

  const radius = q.match(/within (\d{1,3})\s*(mi|miles?|km|kilometers?)/);
  if (radius) {
    const val = Number(radius[1]);
    filters.radiusMi = radius[2].startsWith("k") ? Math.round(val * 0.621) : val;
    eat(/within \d{1,3}\s*(mi|miles?|km|kilometers?)( of [a-z ]+?)?(?= |$)/);
  }

  if (/ (without|no|missing)( a)? (website|site)/.test(q)) {
    filters.website = "none";
    eat(/ (without|no|missing)( a)? (website|site) /);
  } else if (/ (with|has|having)( a)? (website|site)/.test(q)) {
    filters.website = "has";
    eat(/ (with|has|having)( a)? (website|site) /);
  }

  const max = q.match(/(?:top|first|up to|max(?:imum)?) (\d{1,3})/);
  if (max) {
    filters.maxResults = Math.min(100, Math.max(5, Number(max[1])));
    eat(/(top|first|up to|max(imum)?) \d{1,3}/);
  }

  const filler = new Set(["find", "show", "me", "in", "with", "and", "a", "an", "the", "that", "have", "near", "around", "who", "of", "at", "least", "for", "local", "+", "or", "more", "rated", "over"]);
  const unrecognized = consumed
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w && !filler.has(w) && !/^\d+$/.test(w));

  return { filters, unrecognized: Array.from(new Set(unrecognized)).slice(0, 6), unsupportedCity };
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
