import type { OfferProfile } from "@/lib/domain/types";
import { businesses, fixtureVerificationOutcome } from "./fixtures/businesses";
import { DEMO_NOW } from "./fixtures/catalog";
import { researchBusiness } from "./research";
import { generateDraft, defaultFollowUps } from "./drafts";
import type { Campaign, DemoState, DraftRecord, Enrollment, Thread } from "./types";

export const DEMO_SCHEMA = 4;
export const DEMO_STORAGE_KEY = "locentio.demo.v1";

const at = (daysAgo: number, hours = 0) =>
  new Date(Date.parse(DEMO_NOW) - daysAgo * 86_400_000 - hours * 3_600_000).toISOString();

export const sampleOffer: OfferProfile = {
  serviceType: "web_design",
  service: "Website redesign and online booking",
  targetCustomer: "independent dental and health clinics",
  valueProp: "We build fast, mobile-friendly sites with booking built in, usually live within a few weeks.",
  tone: "friendly",
  senderName: "Sam Rivera",
  senderTitle: "Founder",
  companyName: "Northline Studio",
  businessAddress: "100 Sample Street, Austin, TX",
  bookingLink: "https://calendar.example/northline/intro",
};

export const emptyOfferTemplate: OfferProfile = {
  serviceType: "web_design",
  service: "",
  targetCustomer: "",
  valueProp: "",
  tone: "friendly",
  senderName: "",
  senderTitle: "",
  companyName: "",
  businessAddress: "",
  bookingLink: "",
};

function base(): DemoState {
  return {
    schema: DEMO_SCHEMA,
    mode: "empty",
    workspace: { name: "My workspace", onboarded: false },
    offer: null,
    leads: {},
    importedBusinesses: {},
    lists: [],
    contactOverrides: {},
    verifying: [],
    briefs: {},
    researching: [],
    drafts: {},
    campaigns: [],
    enrollments: [],
    threads: [],
    suppression: [],
    usage: [],
    job: null,
    activity: [],
    notices: [],
    progress: {
      searched: false,
      inspectedEvidence: false,
      generatedDraft: false,
      editedDraft: false,
      addedToCampaign: false,
      simulatedLaunch: false,
      viewedReply: false,
    },
    counter: 100,
  };
}

export function emptySeed(): DemoState {
  return base();
}

/**
 * A workspace that already has some sample history, so every screen has
 * something to show. The featured Austin dental clinics (index 0 to 2) are
 * deliberately NOT saved, so the guided flow starts with discovering them.
 */
export function sampleSeed(): DemoState {
  const s = base();
  s.mode = "sample";
  s.workspace = { name: "Northline Studio", onboarded: true };
  s.offer = sampleOffer;

  s.lists = [
    { id: "list_austin", name: "Austin dental · Q4", createdAt: at(6) },
    { id: "list_denver", name: "Denver HVAC", createdAt: at(9) },
  ];

  const austin = businesses.filter((b) => b.niche === "dental" && b.city === "Austin").slice(3);
  const withValid = austin.filter((b) => b.contacts[0] && fixtureVerificationOutcome.get(b.contacts[0].id) === "valid");
  const withCatchAll = austin.find((b) => b.contacts[0] && fixtureVerificationOutcome.get(b.contacts[0].id) === "catch_all");
  const campaignLeads = withValid.slice(0, 3);
  const extraAustin = [withCatchAll, ...withValid.slice(3, 5)].filter((b): b is NonNullable<typeof b> => !!b);
  const denver = businesses.filter((b) => b.niche === "hvac" && b.city === "Denver").slice(0, 4);

  for (const b of [...campaignLeads, ...extraAustin]) {
    s.leads[b.id] = { businessId: b.id, savedAt: at(6, 2), source: "sample", listIds: ["list_austin"], tags: [], notes: "" };
  }
  for (const b of denver) {
    s.leads[b.id] = { businessId: b.id, savedAt: at(9, 1), source: "sample", listIds: ["list_denver"], tags: ["follow up in Q1"], notes: "" };
  }

  // Verified contacts and briefs for the campaign leads and the catch-all lead.
  for (const b of [...campaignLeads, ...extraAustin.slice(0, 1)]) {
    const c = b.contacts[0];
    if (c) s.contactOverrides[c.id] = { status: fixtureVerificationOutcome.get(c.id)!, verifiedAt: at(6), provider: "Demo verifier" };
    s.briefs[b.id] = researchBusiness(b, sampleOffer.serviceType, at(6));
  }

  for (const b of campaignLeads) {
    const brief = s.briefs[b.id];
    const d = generateDraft(b, brief, sampleOffer, 0);
    const draft: DraftRecord = {
      id: `draft_${b.id}`,
      leadId: b.id,
      version: 1,
      subject: d.subject,
      body: d.body,
      factIds: d.factIds,
      origin: "generated",
      variant: 0,
      updatedAt: at(5),
      history: [{ version: 1, subject: d.subject, body: d.body, at: at(5), origin: "generated" }],
    };
    s.drafts[b.id] = draft;
  }

  const campaign: Campaign = {
    id: "camp_sample_austin",
    name: "Sample · Austin dental booking",
    isSample: true,
    status: "running",
    createdAt: at(5, 3),
    updatedAt: at(4),
    launchedAt: at(4),
    leadIds: campaignLeads.map((b) => b.id),
    offerSnapshot: sampleOffer.service,
    steps: [
      { id: "step_1", kind: "initial", delayDays: 0, subject: "Personal draft per lead", body: "" },
      ...defaultFollowUps.map((f, i) => ({ id: `step_${i + 2}`, kind: "follow_up" as const, ...f })),
    ],
    mailboxId: "demo-mailbox",
    schedule: { timezone: "America/Chicago", days: [1, 2, 3, 4, 5], startHour: 9, endHour: 16, dailyCap: 25 },
    policy: { includeCatchAll: false, includeUnknown: false },
    revision: 1,
    approval: {
      revision: 1,
      approvedAt: at(4, 1),
      recipientIds: campaignLeads.map((b) => b.id),
      draftVersions: Object.fromEntries(campaignLeads.map((b) => [b.id, 1])),
    },
  };
  s.campaigns = [campaign];

  const replies = [
    {
      classification: "interested" as const,
      confidence: "high" as const,
      body: "Hi Sam,\n\nFunny timing. We've talked about online booking a few times this year. What would something like that involve for a practice our size? Happy to set up a call next week.\n\nThanks,\nFront desk",
    },
    {
      classification: "out_of_office" as const,
      confidence: "medium" as const,
      body: "Thank you for your email. Our office is closed for staff training and will reopen Monday. Messages will be reviewed then.",
    },
    {
      classification: "not_interested" as const,
      confidence: "high" as const,
      body: "Thanks, but we're happy with our current site. Please take us off your list.",
    },
  ];

  const enrollments: Enrollment[] = [];
  const threads: Thread[] = [];
  campaignLeads.forEach((b, i) => {
    const c = b.contacts[0]!;
    const d = s.drafts[b.id];
    const r = replies[i];
    const human = r.classification !== "out_of_office";
    enrollments.push({
      id: `enr_sample_${i}`,
      campaignId: campaign.id,
      leadId: b.id,
      contactId: c.id,
      state: human ? (r.classification === "not_interested" ? "stopped" : "replied") : "sent",
      reason: r.classification === "not_interested" ? "Unsubscribe request" : human ? "Replied" : null,
      step: 1,
      updatedAt: at(3 - i * 0.5),
    });
    threads.push({
      id: `thread_sample_${i}`,
      leadId: b.id,
      campaignId: campaign.id,
      subject: d.subject,
      isSample: true,
      classification: r.classification,
      classificationSource: "suggested",
      suggestionConfidence: r.confidence,
      unread: i === 0,
      replyDraft: null,
      messages: [
        {
          id: `msg_s_${i}_o`,
          direction: "outbound",
          at: at(4, -i),
          from: "sam@northline-studio.example",
          to: c.email,
          subject: d.subject,
          body: d.body,
          simulated: true,
        },
        {
          id: `msg_s_${i}_i`,
          direction: "inbound",
          at: at(3 - i * 0.5, 2),
          from: c.email,
          to: "sam@northline-studio.example",
          subject: `Re: ${d.subject}`,
          body: r.body,
          simulated: true,
        },
      ],
    });
  });
  s.enrollments = enrollments;
  s.threads = threads;

  const unsub = campaignLeads[2]?.contacts[0];
  s.suppression = [
    ...(unsub
      ? [{ id: "sup_1", value: unsub.email, kind: "email" as const, reason: "unsubscribe" as const, addedAt: at(2), note: "Asked to be removed (sample reply)" }]
      : []),
    { id: "sup_2", value: "do-not-contact.example", kind: "domain", reason: "manual", addedAt: at(8), note: "Existing client of the agency" },
  ];

  s.usage = [
    { id: "u1", at: at(9), kind: "discovery", type: "charge", units: 11, ref: "job_sample_denver", note: "Search: HVAC contractors in Denver" },
    { id: "u2", at: at(6), kind: "discovery", type: "charge", units: 8, ref: "job_sample_austin", note: "Search: Dental clinics in Austin" },
    { id: "u3", at: at(6), kind: "verification", type: "charge", units: 4, ref: "verify_sample", note: "Verified 4 addresses" },
    { id: "u4", at: at(6), kind: "ai", type: "charge", units: 4, ref: "brief_sample", note: "4 Opportunity Briefs" },
    { id: "u5", at: at(5), kind: "ai", type: "charge", units: 3, ref: "draft_sample", note: "3 drafts" },
  ];

  s.activity = [
    { id: "a1", at: at(2), text: "Sample reply marked “Not interested”. Address added to suppression.", href: "/demo/inbox" },
    { id: "a2", at: at(3, 2), text: "Sample reply from a clinic classified as “Interested”.", href: "/demo/inbox" },
    { id: "a3", at: at(4), text: "Simulated launch of “Sample · Austin dental booking” (3 recipients).", href: "/demo/campaigns" },
    {
      id: "a4",
      at: at(6),
      text: `Saved ${campaignLeads.length + extraAustin.length} Austin dental clinics to “Austin dental · Q4”.`,
      href: "/demo/leads",
    },
  ];
  return s;
}
