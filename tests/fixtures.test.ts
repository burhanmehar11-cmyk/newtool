import { describe, expect, it } from "vitest";
import { businesses } from "@/demo/fixtures/businesses";
import { sampleSeed } from "@/demo/seed";

describe("demo fixtures are clearly fictional and safe", () => {
  it("has unique ids", () => {
    expect(new Set(businesses.map((b) => b.id)).size).toBe(businesses.length);
  });

  it("uses only reserved .example domains for websites, emails and sources", () => {
    for (const b of businesses) {
      if (b.domain) expect(b.domain.endsWith(".example")).toBe(true);
      for (const c of b.contacts) expect(c.email).toMatch(/@[a-z0-9-]+\.example$/);
      for (const e of b.evidence) expect(new URL(e.url).hostname.endsWith(".example")).toBe(true);
    }
  });

  it("uses the 555-01XX fictional phone range", () => {
    for (const b of businesses) expect(b.phone).toMatch(/555-01\d\d$/);
  });

  it("never invents named contacts", () => {
    for (const b of businesses) for (const c of b.contacts) expect(c.kind).toBe("role");
  });

  it("is deterministic (stable count and featured names)", () => {
    expect(businesses.length).toBe(376);
    expect(businesses.find((b) => b.id === "biz_dental_austin_0")?.name).toBe("Bluebonnet Family Dentistry");
    expect(businesses.find((b) => b.id === "biz_hvac_denver_0")?.name).toMatchSnapshot();
  });

  it("starts every discovered contact as unverified", () => {
    for (const b of businesses) for (const c of b.contacts) expect(c.status).toBe("unverified");
  });

  it("sample seed marks its campaign as sample data", () => {
    const s = sampleSeed();
    expect(s.campaigns.every((c) => c.isSample)).toBe(true);
    expect(s.threads.every((t) => t.isSample && t.messages.every((m) => m.simulated))).toBe(true);
  });
});
