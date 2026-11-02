import { describe, expect, it } from "vitest";
import { parseQuery } from "@/demo/parse";

describe("natural-language query parser", () => {
  it("parses the hero example", () => {
    const r = parseQuery("Find dental clinics in Austin with a website and 30+ reviews.");
    expect(r.filters).toMatchObject({ niche: "dental", city: "Austin", website: "has", minReviews: 30 });
    expect(r.unrecognized).toEqual([]);
  });

  it("parses decimal ratings, radius and limits", () => {
    const r = parseQuery("HVAC contractors in Denver rated 4.5+ within 10 miles top 40");
    expect(r.filters).toMatchObject({ niche: "hvac", city: "Denver", minRating: 4.5, radiusMi: 10, maxResults: 40 });
  });

  it("handles 'without a website'", () => {
    expect(parseQuery("med spas in Raleigh without a website").filters.website).toBe("none");
  });

  it("flags cities without sample data instead of guessing", () => {
    const r = parseQuery("roofers near Boise");
    expect(r.filters.city).toBeNull();
    expect(r.unsupportedCity).toBe("Boise");
  });

  it("reports words it did not understand", () => {
    const r = parseQuery("dentists in Austin that are hiring");
    expect(r.unrecognized).toContain("hiring");
  });
});
