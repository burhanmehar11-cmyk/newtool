import { describe, expect, it } from "vitest";
import { businesses, getBusiness } from "@/demo/fixtures/businesses";
import { researchBusiness } from "@/demo/research";
import { generateDraft } from "@/demo/drafts";
import { sampleOffer } from "@/demo/seed";
import { opportunityBriefSchema } from "@/lib/domain/schemas";
import type { OfferType } from "@/lib/domain/types";

const offers: OfferType[] = ["web_design", "local_seo", "ai_automation", "marketing"];

describe("Opportunity Briefs", () => {
  it("ties every fact to evidence that exists, and every opportunity to facts", () => {
    for (const b of businesses.slice(0, 120)) {
      for (const o of offers) {
        const br = researchBusiness(b, o, "2026-10-30T00:00:00Z");
        const ev = new Set(b.evidence.map((e) => e.id));
        const facts = new Set(br.facts.map((f) => f.id));
        for (const f of br.facts) for (const id of f.evidenceIds) expect(ev.has(id)).toBe(true);
        for (const op of br.opportunities) {
          expect(op.basedOnFactIds.length).toBeGreaterThan(0);
          for (const id of op.basedOnFactIds) expect(facts.has(id)).toBe(true);
        }
        expect(opportunityBriefSchema.safeParse(br).success).toBe(true);
      }
    }
  });

  it("never counts Unknown criteria toward fit", () => {
    for (const b of businesses) {
      const br = researchBusiness(b, "web_design", "x");
      const unknownWeight = br.rubric.filter((r) => r.met === null).reduce((a, r) => a + r.weight, 0);
      const metWeight = br.rubric.filter((r) => r.met === true).reduce((a, r) => a + r.weight, 0);
      expect(br.fit.points).toBe(metWeight);
      expect(br.fit.maxKnown).toBe(br.fit.maxTotal - unknownWeight);
    }
  });

  it("lowers confidence when signals are missing", () => {
    const b = getBusiness("biz_dental_austin_0");
    const blind = { ...b, signals: { ...b.signals, siteCopyrightYear: null, mobileViewport: null, onlineBooking: null, contactForm: null } };
    expect(researchBusiness(b, "web_design", "x").confidence.level).toBe("high");
    expect(researchBusiness(blind, "web_design", "x").confidence.level).toBe("low");
  });

  it("always lists the decision-maker as Unknown rather than guessing", () => {
    const br = researchBusiness(getBusiness("biz_dental_austin_1"), "local_seo", "x");
    expect(br.unknowns.some((u) => u.startsWith("Named decision-maker: Unknown"))).toBe(true);
  });

  it("scores the same business differently for different offers", () => {
    const b = getBusiness("biz_dental_austin_1");
    expect(researchBusiness(b, "web_design", "x").fit.level).not.toBe(researchBusiness(b, "local_seo", "x").fit.level);
  });

  it("drafts reference a fact from the brief and keep the opt-out line", () => {
    const b = getBusiness("biz_dental_austin_0");
    const br = researchBusiness(b, "web_design", "x");
    for (const v of [0, 1, 2]) {
      const d = generateDraft(b, br, sampleOffer, v);
      expect(d.factIds.length).toBe(1);
      expect(br.facts.map((f) => f.id)).toContain(d.factIds[0]);
      expect(d.body).toContain("reply \"no thanks\"");
      expect(d.body).toContain(sampleOffer.businessAddress);
    }
  });
});
