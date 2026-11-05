import { describe, expect, it } from "vitest";
import { countries, countryName, isCountryCode, placeLabel, STATES } from "@/lib/geo/regions";
import { buildTextSearchBody } from "@/lib/discovery/google-places";
import { matchNiche } from "@/server/services/discovery";

describe("countries and states", () => {
  it("lists countries by name with ISO codes", () => {
    const list = countries();
    expect(list.length).toBeGreaterThan(190);
    expect(list.find((c) => c.code === "PK")?.name).toBe("Pakistan");
    expect(list.map((c) => c.name)).toEqual([...list.map((c) => c.name)].sort((a, b) => a.localeCompare(b)));
    expect(isCountryCode("us")).toBe(true);
    expect(isCountryCode("XX")).toBe(false);
    expect(countryName("gb")).toBe("United Kingdom");
    expect(STATES.US).toContain("New York");
  });
  it("builds a place label from the filled-in parts", () => {
    expect(placeLabel({ city: " Lahore ", state: "Punjab", country: "PK" })).toBe("Lahore, Punjab, Pakistan");
    expect(placeLabel({ city: "Austin", state: "", country: null })).toBe("Austin");
  });
});

describe("free-text business type", () => {
  it("maps known types to presets and leaves the rest as typed", () => {
    expect(matchNiche("Dental clinics")).toBe("dental");
    expect(matchNiche("dental clinic")).toBe("dental");
    expect(matchNiche("roofing contractors")).toBe("roofing");
    expect(matchNiche("wedding photographers")).toBeNull();
  });
  it("passes the country to Google as a region bias", () => {
    expect(buildTextSearchBody({ query: "solar installers in Leeds, England, United Kingdom", regionCode: "GB" })).toMatchObject({ regionCode: "GB" });
    expect(buildTextSearchBody({ query: "x", regionCode: "gb" })).not.toHaveProperty("regionCode");
  });
});
