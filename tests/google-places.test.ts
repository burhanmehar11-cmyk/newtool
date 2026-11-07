import { describe, expect, it } from "vitest";
import {
  buildTextSearchBody,
  googleMapsLink,
  parseGoogleError,
  parseTextSearch,
  PLACE_ID,
  TEXT_SEARCH_FIELD_MASK,
} from "@/lib/discovery/google-places";
import { siteNameOf } from "@/lib/research/extract";
import { normalizeWebsite } from "@/lib/discovery/osm";

describe("website normalisation", () => {
  it("drops tracking parameters Google listings often carry", () => {
    expect(normalizeWebsite("https://www.x.example/?utm_source=gmb&utm_medium=organic&page=2")).toEqual({ website: "https://www.x.example/?page=2", domain: "x.example" });
  });
});

// Fictional fixture shaped like a Places API (New) Text Search response.
const response = {
  places: [
    {
      id: "ChIJ_fictional_place_0001",
      displayName: { text: "Sample Family Dental", languageCode: "en" },
      formattedAddress: "100 Example St, Austin, TX 78701, USA",
      websiteUri: "https://sample-dental.example/",
      nationalPhoneNumber: "(512) 555-0100",
      rating: 4.8,
      userRatingCount: 212,
      businessStatus: "OPERATIONAL",
      primaryTypeDisplayName: { text: "Dentist", languageCode: "en-US" },
    },
    { id: "ChIJ_fictional_place_0002", displayName: { text: "No Site Dental" }, businessStatus: "CLOSED_TEMPORARILY" },
    { id: "bad id with spaces", displayName: { text: "Broken" } },
    { id: "ChIJ_fictional_place_0003", websiteUri: "javascript:alert(1)" },
  ],
  nextPageToken: "token-abc",
};

describe("Google Places (New) helpers", () => {
  it("builds a Text Search body with 20 per page and optional filters", () => {
    expect(buildTextSearchBody({ query: "  dentists in Austin, TX " })).toEqual({ textQuery: "dentists in Austin, TX", pageSize: 20 });
    expect(buildTextSearchBody({ query: "x", pageToken: "t", minRating: 4.5 })).toEqual({ textQuery: "x", pageSize: 20, pageToken: "t", minRating: 4.5 });
    expect(buildTextSearchBody({ query: "x", minRating: 0 })).not.toHaveProperty("minRating");
  });

  it("asks only for the fields it shows, plus the page token", () => {
    expect(TEXT_SEARCH_FIELD_MASK.split(",")).toEqual(expect.arrayContaining(["places.id", "places.websiteUri", "places.rating", "nextPageToken"]));
    expect(TEXT_SEARCH_FIELD_MASK).not.toContain("reviews");
  });

  it("parses places, keeps missing values as null and drops invalid ids and unsafe URLs", () => {
    const r = parseTextSearch(response);
    expect(r.nextPageToken).toBe("token-abc");
    expect(r.places.map((p) => p.placeId)).toEqual(["ChIJ_fictional_place_0001", "ChIJ_fictional_place_0002", "ChIJ_fictional_place_0003"]);
    expect(r.places[0]).toEqual({
      placeId: "ChIJ_fictional_place_0001",
      lat: null,
      lng: null,
      name: "Sample Family Dental",
      address: "100 Example St, Austin, TX 78701, USA",
      phone: "(512) 555-0100",
      website: "https://sample-dental.example/",
      rating: 4.8,
      ratingCount: 212,
      category: "Dentist",
      status: "OPERATIONAL",
    });
    expect(r.places[1]).toMatchObject({ website: null, rating: null, ratingCount: null, address: null, status: "CLOSED_TEMPORARILY" });
    expect(r.places[2].website).toBeNull();
    expect(parseTextSearch({})).toEqual({ places: [], nextPageToken: null });
    expect(parseTextSearch(null)).toEqual({ places: [], nextPageToken: null });
  });

  it("reads Google's error shape", () => {
    expect(parseGoogleError({ error: { code: 403, status: "PERMISSION_DENIED", message: "API not enabled" } })).toEqual({ status: "PERMISSION_DENIED", message: "API not enabled" });
    expect(parseGoogleError("nope")).toEqual({ status: null, message: null });
  });

  it("links to Google Maps from the stored place id only", () => {
    const u = new URL(googleMapsLink("ChIJ_fictional_place_0001", "atxdental.example"));
    expect(u.origin + u.pathname).toBe("https://www.google.com/maps/search/");
    expect(u.searchParams.get("api")).toBe("1");
    expect(u.searchParams.get("query_place_id")).toBe("ChIJ_fictional_place_0001");
    expect(PLACE_ID.test("ChIJ_fictional_place_0001")).toBe(true);
    expect(PLACE_ID.test("../etc/passwd")).toBe(false);
  });
});

describe("site name from the business's own homepage", () => {
  it("prefers og:site_name", () => {
    expect(siteNameOf(`<meta property="og:site_name" content="Smile &amp; Co Dental">`, "Home | Whatever")).toBe("Smile & Co Dental");
  });
  it("falls back to the most name-like part of the title", () => {
    expect(siteNameOf("", "Home | Smile Dental")).toBe("Smile Dental");
    expect(siteNameOf("", "Smile Dental - Dentist in Austin, TX")).toBe("Smile Dental");
    expect(siteNameOf("", "Welcome")).toBeNull();
    expect(siteNameOf("", null)).toBeNull();
  });

  it("restricts a search to a rectangle and splits an area into a grid", async () => {
    const { buildTextSearchBody, gridTiles, extendBox } = await import("@/lib/discovery/google-places");
    expect(buildTextSearchBody({ query: "dentists in Austin", box: { s: 30, w: -98, n: 30.5, e: -97.5 } }).locationRestriction).toEqual({
      rectangle: { low: { latitude: 30, longitude: -98 }, high: { latitude: 30.5, longitude: -97.5 } },
    });
    let box = extendBox(null, 30.2, -97.8);
    box = extendBox(box, 30.4, -97.6);
    const tiles = gridTiles(box);
    expect(tiles).toHaveLength(9);
    // The grid covers the whole area (a little beyond it).
    expect(Math.min(...tiles.map((t) => t.s))).toBeLessThan(30.2);
    expect(Math.max(...tiles.map((t) => t.n))).toBeGreaterThan(30.4);
    // A single point still gives a usable area (about 4 km across).
    const one = gridTiles(extendBox(null, 51.5, -0.12));
    expect(Math.max(...one.map((t) => t.n)) - Math.min(...one.map((t) => t.s))).toBeCloseTo(0.04, 5);
  });
});
