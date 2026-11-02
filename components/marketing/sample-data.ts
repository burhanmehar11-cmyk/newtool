import { getBusiness } from "@/demo/fixtures/businesses";
import { DEMO_NOW } from "@/demo/fixtures/catalog";
import { researchBusiness } from "@/demo/research";
import { generateDraft } from "@/demo/drafts";
import { sampleOffer } from "@/demo/seed";
import type { Tone } from "@/lib/domain/types";

/** Fictional sample leads used on the marketing page. Deterministic, so server and client agree. */
export const featuredIds = ["biz_dental_austin_0", "biz_dental_austin_1", "biz_dental_austin_2", "biz_dental_austin_4", "biz_dental_austin_5"];

export const featured = featuredIds.map((id) => {
  const business = getBusiness(id);
  const brief = researchBusiness(business, sampleOffer.serviceType, DEMO_NOW);
  return { business, brief, draft: generateDraft(business, brief, sampleOffer, 2) };
});

export function draftFor(index: number, tone: Tone, variant: number) {
  const f = featured[index];
  return generateDraft(f.business, f.brief, { ...sampleOffer, tone }, variant);
}

export const heroQuery = "Find dental clinics in Austin with a website and 30+ reviews.";
