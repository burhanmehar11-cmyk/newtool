import { afterEach, describe, expect, it, vi } from "vitest";
import { OVERPASS_URLS, searchBusinesses } from "@/server/providers/osm";

const args = { selectors: ['node["amenity"="dentist"]'], center: { lat: 30.27, lon: -97.74, label: "Austin" }, radiusKm: 2, website: "any" as const, limit: 5 };
const body = { elements: [{ type: "node", id: 1, lat: 30.27, lon: -97.74, tags: { name: "Sample Dental", amenity: "dentist" } }] };
const json = (status: number, data: unknown = body) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("Overpass fallback", () => {
  it("has more than one public instance by default", () => {
    expect(OVERPASS_URLS.length).toBeGreaterThanOrEqual(2);
  });

  it("moves on to the next instance when one answers 406", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("Not Acceptable", { status: 406 })).mockResolvedValueOnce(json(200));
    vi.stubGlobal("fetch", fetchMock);
    const r = await searchBusinesses(args as never);
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(OVERPASS_URLS[1]);
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.accept).toContain("*/*");
    expect(headers["user-agent"]).toMatch(/^Locentio\//);
  });

  it("reports the last error when every instance refuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("", { status: 406 })));
    const r = await searchBusinesses(args as never);
    expect(r).toMatchObject({ ok: false, error: { message: expect.stringContaining("HTTP 406") } });
  });

  it("doesn't retry a bad query (400)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await searchBusinesses(args as never)).ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
