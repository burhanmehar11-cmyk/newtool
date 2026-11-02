/**
 * Domain model shared by the demo (M1) and the live product (M2).
 * M2 maps these onto PostgreSQL tables (see docs/ARCHITECTURE.md).
 */

export type NicheId = "dental" | "hvac" | "medspa" | "physio" | "roofing" | "law" | "vet" | "landscaping";

export type OfferType = "local_seo" | "web_design" | "ai_automation" | "marketing";

export type Tone = "friendly" | "direct" | "consultative";

/** Email verification state. MX existence alone is never "valid". */
export type EmailStatus = "unverified" | "valid" | "invalid" | "catch_all" | "unknown";

export type EvidenceKind = "listing" | "homepage" | "contact_page" | "reviews" | "forms_page";

export type Evidence = {
  id: string;
  businessId: string;
  kind: EvidenceKind;
  label: string;
  url: string;
  /** ISO timestamp the source was collected. */
  collectedAt: string;
  /** Captured text from the source, shown verbatim. */
  excerpt: string;
};

/** Facts collected from permitted public sources. `null` means Unknown, never "missing". */
export type BusinessSignals = {
  siteCopyrightYear: number | null;
  mobileViewport: boolean | null;
  onlineBooking: boolean | null;
  intakeMethod: "phone_only" | "online_form" | "pdf_forms" | null;
  ownerReplyShare: { replied: number; sampled: number } | null;
  hoursListed: boolean | null;
  photoCount: number | null;
  contactForm: boolean | null;
};

export type Contact = {
  id: string;
  businessId: string;
  email: string;
  /** Role address (info@, hello@). Named people are never invented. */
  kind: "role";
  sourceEvidenceId: string;
  status: EmailStatus;
  verifiedAt: string | null;
  verificationProvider: string | null;
};

export type Business = {
  id: string;
  name: string;
  niche: NicheId;
  city: string;
  region: string;
  address: string;
  phone: string;
  website: string | null;
  domain: string | null;
  rating: number | null;
  reviewCount: number | null;
  distanceMi: number;
  provider: { name: string; ref: string };
  collectedAt: string;
  signals: BusinessSignals;
  evidence: Evidence[];
  contacts: Contact[];
};

export type Fact = { id: string; text: string; evidenceIds: string[] };

export type Opportunity = {
  id: string;
  /** Inferred, AI-suggested. Always shown as a suggestion, not a fact. */
  text: string;
  basedOnFactIds: string[];
  relevance: string;
};

export type RubricItem = {
  id: string;
  criterion: string;
  weight: number;
  /** true = met, false = not met, null = Unknown (not counted either way). */
  met: boolean | null;
  note: string;
};

export type FitLevel = "strong" | "moderate" | "weak";
export type Confidence = "high" | "medium" | "low";

export type OpportunityBrief = {
  id: string;
  businessId: string;
  offerType: OfferType;
  generatedAt: string;
  generator: "demo-template" | "template" | "ai";
  facts: Fact[];
  opportunities: Opportunity[];
  unknowns: string[];
  rubric: RubricItem[];
  fit: { level: FitLevel; points: number; maxKnown: number; maxTotal: number };
  confidence: { level: Confidence; reason: string };
  angle: string;
};

export type Draft = {
  id: string;
  leadId: string;
  version: number;
  subject: string;
  body: string;
  /** Evidence the draft relies on. */
  factIds: string[];
  origin: "generated" | "edited";
  variant: number;
  updatedAt: string;
};

export type OfferProfile = {
  serviceType: OfferType;
  service: string;
  targetCustomer: string;
  valueProp: string;
  tone: Tone;
  senderName: string;
  senderTitle: string;
  companyName: string;
  businessAddress: string;
  bookingLink: string;
};

export type DiscoveryFilters = {
  niche: NicheId | null;
  city: string | null;
  radiusMi: number | null;
  minRating: number | null;
  minReviews: number | null;
  website: "any" | "has" | "none";
  maxResults: number;
};
