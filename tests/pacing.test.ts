import { describe, expect, it } from "vitest";
import { MAX_GAP_MS, MIN_GAP_MS, gapAfter, hourlyCap } from "@/lib/campaigns/pacing";

/** Sending pace: varying gaps between emails, and a day's emails spread over several hours. */

describe("pacing", () => {
  it("waits between 3 and 9 minutes, differently after each email, and the same every time it's asked", () => {
    const base = Date.parse("2026-11-21T10:00:00Z");
    const gaps = Array.from({ length: 200 }, (_, i) => gapAfter("box-1", new Date(base + i * 397_000)));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(MIN_GAP_MS);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(MAX_GAP_MS);
    expect(new Set(gaps.map((g) => Math.round(g / 60_000))).size).toBeGreaterThanOrEqual(5); // spread across the range
    expect(gapAfter("box-1", "2026-11-21T10:00:00.000Z")).toBe(gapAfter("box-1", new Date("2026-11-21T10:00:00Z")));
    expect(gapAfter("box-1", "2026-11-21T10:00:00Z")).not.toBe(gapAfter("box-2", "2026-11-21T10:00:00Z"));
  });

  it("allows a third of the daily limit per hour, between 3 and 15", () => {
    expect(hourlyCap(1)).toBe(3);
    expect(hourlyCap(25)).toBe(9);
    expect(hourlyCap(30)).toBe(10);
    expect(hourlyCap(200)).toBe(15);
  });
});
