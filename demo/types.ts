import type { Business, DiscoveryFilters, Draft, EmailStatus, OfferProfile, OpportunityBrief } from "@/lib/domain/types";

export type UsageKind = "discovery" | "verification" | "ai";

export type UsageEntry = {
  id: string;
  at: string;
  kind: UsageKind;
  /** reserve: held before work starts; charge: actual use; release: unused reservation returned. */
  type: "reserve" | "charge" | "release";
  units: number;
  ref: string;
  note: string;
};

export type LeadRecord = {
  businessId: string;
  savedAt: string;
  source: "search" | "import" | "sample";
  listIds: string[];
  tags: string[];
  notes: string;
};

export type ContactOverride = { status: EmailStatus; verifiedAt: string | null; provider: string | null };

export type DraftRecord = Draft & {
  history: { version: number; subject: string; body: string; at: string; origin: Draft["origin"] }[];
};

export type JobStatus = "running" | "completed" | "partial" | "failed" | "cancelled" | "interrupted";

export type DiscoveryJob = {
  id: string;
  query: string;
  filters: DiscoveryFilters;
  status: JobStatus;
  totalPages: number;
  pages: { index: number; status: "pending" | "done" | "failed"; ids: string[] }[];
  resultIds: string[];
  error: string | null;
  reservedUnits: number;
  chargedUnits: number;
  startedAt: string;
  finishedAt: string | null;
  failNextPage: boolean;
};

export type CampaignStatus = "draft" | "running" | "paused" | "completed" | "cancelled";

export type CampaignStep = {
  id: string;
  kind: "initial" | "follow_up";
  delayDays: number;
  subject: string;
  body: string;
};

export type Campaign = {
  id: string;
  name: string;
  isSample: boolean;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  launchedAt: string | null;
  leadIds: string[];
  offerSnapshot: string;
  steps: CampaignStep[];
  mailboxId: "demo-mailbox" | null;
  schedule: { timezone: string; days: number[]; startHour: number; endHour: number; dailyCap: number };
  policy: { includeCatchAll: boolean; includeUnknown: boolean };
  /** Increments on any change to recipients, content, schedule or policy. */
  revision: number;
  approval: {
    revision: number;
    approvedAt: string;
    recipientIds: string[];
    draftVersions: Record<string, number>;
  } | null;
};

export type EnrollmentState = "queued" | "sent" | "replied" | "stopped";

export type Enrollment = {
  id: string;
  campaignId: string;
  leadId: string;
  contactId: string;
  state: EnrollmentState;
  reason: string | null;
  step: number;
  updatedAt: string;
};

export type Classification = "interested" | "not_interested" | "out_of_office" | "unclassified";

export type Message = {
  id: string;
  direction: "outbound" | "inbound";
  at: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  /** Always true in the demo: no message is ever delivered. */
  simulated: true;
};

export type Thread = {
  id: string;
  leadId: string;
  campaignId: string;
  subject: string;
  messages: Message[];
  classification: Classification;
  classificationSource: "suggested" | "user";
  suggestionConfidence: "high" | "medium" | "low";
  unread: boolean;
  replyDraft: string | null;
  isSample: boolean;
};

export type SuppressionEntry = {
  id: string;
  value: string;
  kind: "email" | "domain";
  reason: "unsubscribe" | "manual" | "bounce";
  addedAt: string;
  note: string;
};

export type Activity = { id: string; at: string; text: string; href?: string };

export type Notice = { id: string; tone: "success" | "info" | "error"; title: string; body?: string };

export type DemoProgress = {
  searched: boolean;
  inspectedEvidence: boolean;
  generatedDraft: boolean;
  editedDraft: boolean;
  addedToCampaign: boolean;
  simulatedLaunch: boolean;
  viewedReply: boolean;
};

export type DemoState = {
  schema: number;
  mode: "sample" | "empty";
  workspace: { name: string; onboarded: boolean };
  offer: OfferProfile | null;
  leads: Record<string, LeadRecord>;
  importedBusinesses: Record<string, Business>;
  lists: { id: string; name: string; createdAt: string }[];
  contactOverrides: Record<string, ContactOverride>;
  verifying: string[];
  briefs: Record<string, OpportunityBrief>;
  researching: string[];
  drafts: Record<string, DraftRecord>;
  campaigns: Campaign[];
  enrollments: Enrollment[];
  threads: Thread[];
  suppression: SuppressionEntry[];
  usage: UsageEntry[];
  job: DiscoveryJob | null;
  activity: Activity[];
  notices: Notice[];
  progress: DemoProgress;
  counter: number;
};
