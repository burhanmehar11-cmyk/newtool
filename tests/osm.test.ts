import { describe, expect, it } from "vitest";
import { buildOverpassQuery, haversineKm, normalizeWebsite, parseNominatim, parseOverpass } from "@/lib/discovery/osm";

// Shapes follow the documented Overpass JSON (out center tags) and Nominatim jsonv2 formats.
const overpass = {
  elements: [
    { type: "node", id: 1, lat: 30.27, lon: -97.74, tags: { name: "Near Dental", amenity: "dentist", website: "near-dental.example", phone: "+1 512 555 0100", email: "Hello@Near-Dental.example", "addr:housenumber": "100", "addr:street": "Main St", "addr:city": "Austin", "addr:state": "TX" } },
    { type: "way", id: 2, center: { lat: 30.3, lon: -97.74 }, tags: { name: "Far Dental", healthcare: "dentist" } },
    { type: "node", id: 1, lat: 30.27, lon: -97.74, tags: { name: "Near Dental", amenity: "dentist" } }, // duplicate
    { type: "node", id: 3, lat: 30.28, lon: -97.75, tags: { amenity: "dentist" } }, // no name
    { type: "node", id: 4, lat: 30.271, lon: -97.741, tags: { name: "Bad Email Dental", amenity: "dentist", email: "not an email", "contact:website": "javascript:alert(1)" } },
  ],
};

describe("OpenStreetMap discovery helpers", () => {
  it("builds a bounded Overpass query for every selector", () => {
    const q = buildOverpassQuery({ selectors: ['["amenity"="dentist"]', '["healthcare"="dentist"]'], lat: 30.2672, lon: -97.7431, radiusKm: 999, limit: 9999 });
    expect(q).toContain('nwr["amenity"="dentist"]["name"](around:50000,30.267200,-97.743100);');
    expect(q).toContain('nwr["healthcare"="dentist"]["name"]');
    expect(q).toMatch(/out center tags 500;$/);
  });

  it("parses Nominatim", () => {
    expect(parseNominatim([{ lat: "30.2672", lon: "-97.7431", display_name: "Austin, Texas" }])).toEqual({ lat: 30.2672, lon: -97.7431, label: "Austin, Texas" });
    expect(parseNominatim([])).toBeNull();
  });

  it("dedupes, drops unnamed objects, sorts by distance and normalises fields", () => {
    const r = parseOverpass(overpass, { center: { lat: 30.2672, lon: -97.7431 }, website: "any", limit: 10 });
    expect(r.map((b) => b.name)).toEqual(["Near Dental", "Bad Email Dental", "Far Dental"]);
    const near = r.find((b) => b.name === "Near Dental")!;
    expect(near).toMatchObject({ ref: "osm:node/1", domain: "near-dental.example", email: "hello@near-dental.example", address: "100 Main St, Austin, TX", sourceUrl: "https://www.openstreetmap.org/node/1" });
    const bad = r.find((b) => b.name === "Bad Email Dental")!;
    expect(bad.email).toBeNull();
    expect(bad.website).toBeNull();
    expect(r.find((b) => b.name === "Far Dental")!.ref).toBe("osm:way/2");
  });

  it("applies the website filter and the limit", () => {
    const has = parseOverpass(overpass, { center: { lat: 30.2672, lon: -97.7431 }, website: "has", limit: 10 });
    expect(has.map((b) => b.name)).toEqual(["Near Dental"]);
    const none = parseOverpass(overpass, { center: { lat: 30.2672, lon: -97.7431 }, website: "none", limit: 1 });
    expect(none).toHaveLength(1);
  });

  it("normalises websites and rejects unsafe schemes", () => {
    expect(normalizeWebsite("www.Example.com/path")).toEqual({ website: "https://www.example.com/path", domain: "example.com" });
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
  });

  it("computes distances", () => {
    expect(Math.round(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }))).toBe(111);
  });
});
