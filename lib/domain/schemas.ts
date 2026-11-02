import { z } from "zod";

/** Offer profile form (onboarding and settings). */
export const offerProfileSchema = z.object({
  serviceType: z.enum(["local_seo", "web_design", "ai_automation", "marketing"]),
  service: z.string().trim().min(3, "Describe the service in a few words.").max(120),
  targetCustomer: z.string().trim().min(3, "Who do you want to reach?").max(160),
  valueProp: z.string().trim().min(10, "One or two sentences on the outcome you deliver.").max(400),
  tone: z.enum(["friendly", "direct", "consultative"]),
  senderName: z.string().trim().min(2, "Add the name recipients will see.").max(80),
  senderTitle: z.string().trim().max(80),
  companyName: z.string().trim().min(2, "Add your company name.").max(120),
  businessAddress: z.string().trim().min(5, "A business address is expected in commercial email in many markets.").max(200),
  bookingLink: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Use a full https:// link, or leave it empty."),
});

export type OfferProfileInput = z.infer<typeof offerProfileSchema>;

export const onboardingSchema = offerProfileSchema.extend({
  workspaceName: z.string().trim().min(2, "Name your workspace.").max(80),
});

/**
 * Structured AI output for an Opportunity Brief. M2 validates every model
 * response against this before storing it; invalid output is rejected, not
 * repaired by guessing.
 */
export const opportunityBriefSchema = z.object({
  facts: z.array(z.object({ id: z.string(), text: z.string().max(400), evidenceIds: z.array(z.string()).min(1) })).max(20),
  opportunities: z
    .array(z.object({ id: z.string(), text: z.string().max(400), basedOnFactIds: z.array(z.string()).min(1), relevance: z.string().max(400) }))
    .max(5),
  unknowns: z.array(z.string().max(200)).max(20),
  confidence: z.object({ level: z.enum(["high", "medium", "low"]), reason: z.string().max(300) }),
  angle: z.string().max(500),
  draft: z.object({ subject: z.string().min(1).max(140), body: z.string().min(1).max(4000) }).optional(),
});
