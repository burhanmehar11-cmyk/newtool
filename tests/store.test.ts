import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demo, getDemoState } from "@/demo/store";
import { approvalValid, evaluateRecipients, usageSummary } from "@/demo/selectors";
import { DEFAULT_FILTERS } from "@/demo/parse";
import { getBusiness } from "@/demo/fixtures/businesses";

/**
 * Behavioural tests for the demo store. These encode the same rules M2 must
 * enforce server-side: approvals tied to versions, re-checks before dispatch,
 * idempotent usage, suppression that survives re-import, and no duplicate
 * active outreach.
 */
const BLUE = "biz_dental_austin_0";
const blueContact = () => getBusiness(BLUE).contacts[0].id;

function prepareLead(id = BLUE) {
  demo.saveLeads([id]);
  demo.research(id);
  vi.advanceTimersByTime(2000);
  expect(demo.generateDraft(id).ok).toBe(true);
  demo.verify(getBusiness(id).contacts.map((c) => c.id));
  vi.advanceTimersByTime(2000);
}

function readyCampaign(leads = [BLUE]) {
  const id = demo.createCampaign("Test", leads);
  demo.updateCampaign(id, { mailboxId: "demo-mailbox" });
  return id;
}

const campaign = (id: string) => getDemoState().campaigns.find((c) => c.id === id)!;

beforeEach(() => {
  vi.useFakeTimers();
  demo.reset("sample");
});
afterEach(() => {
  vi.useRealTimers();
});

describe("discovery usage", () => {
  it("reserves the estimate, charges results, and releases the rest", () => {
    const before = usageSummary(getDemoState()).discovery.used;
    demo.startSearch("q", { ...DEFAULT_FILTERS, niche: "dental", city: "Austin", maxResults: 25 });
    expect(usageSummary(getDemoState()).discovery.reserved).toBe(25);
    vi.advanceTimersByTime(10_000);
    const s = getDemoState();
    expect(s.job?.status).toBe("completed");
    expect(usageSummary(s).discovery.reserved).toBe(0);
    expect(usageSummary(s).discovery.used - before).toBe(s.job!.resultIds.length);
  });

  it("does not charge a failed page, and retry completes the search", () => {
    demo.startSearch("q", { ...DEFAULT_FILTERS, niche: "dental", city: "Austin", maxResults: 25 }, { failNextPage: true });
    vi.advanceTimersByTime(10_000);
    let s = getDemoState();
    expect(s.job?.status).toBe("partial");
    expect(s.job?.resultIds.length).toBe(10);
    demo.retryFailedPage();
    vi.advanceTimersByTime(10_000);
    s = getDemoState();
    expect(s.job?.status).toBe("completed");
    expect(s.job?.chargedUnits).toBe(s.job?.resultIds.length);
  });

  it("refuses a search that could exceed the allowance", () => {
    const r = demo.startSearch("q", { ...DEFAULT_FILTERS, niche: "dental", city: "Austin", maxResults: 100 });
    expect(r.ok).toBe(true);
    const second = demo.startSearch("q", { ...DEFAULT_FILTERS, niche: "dental", city: "Austin", maxResults: 100 });
    expect(second.ok).toBe(false);
  });
});

describe("verification", () => {
  it("charges once per address even if verify is called again", () => {
    demo.verify([blueContact()]);
    demo.verify([blueContact()]);
    vi.advanceTimersByTime(3000);
    demo.verify([blueContact()]);
    vi.advanceTimersByTime(3000);
    const charges = getDemoState().usage.filter((u) => u.ref === `verify_${blueContact()}` && u.type === "charge");
    expect(charges).toHaveLength(1);
  });
});

describe("campaign approval", () => {
  it("editing a draft after approval invalidates the approval", () => {
    prepareLead();
    const id = readyCampaign();
    expect(demo.approveCampaign(id).ok).toBe(true);
    expect(approvalValid(campaign(id))).toBe(true);
    demo.saveDraft(BLUE, "New subject", "New body");
    expect(approvalValid(campaign(id))).toBe(false);
    expect(demo.simulateLaunch(id).ok).toBe(false);
  });

  it("only approved recipients are enrolled, and launch sends nothing real", () => {
    prepareLead();
    const id = readyCampaign();
    demo.approveCampaign(id);
    expect(demo.simulateLaunch(id).ok).toBe(true);
    vi.advanceTimersByTime(2000);
    const s = getDemoState();
    const sent = s.threads.find((t) => t.campaignId === id)!;
    expect(sent.messages.every((m) => m.simulated)).toBe(true);
  });

  it("a reply stops follow-ups for that lead", () => {
    prepareLead();
    const id = readyCampaign();
    demo.approveCampaign(id);
    demo.simulateLaunch(id);
    vi.advanceTimersByTime(10_000);
    const e = getDemoState().enrollments.find((x) => x.campaignId === id && x.leadId === BLUE)!;
    expect(e.state).toBe("replied");
  });

  it("pausing before dispatch keeps queued messages from going out", () => {
    prepareLead();
    const id = readyCampaign();
    demo.approveCampaign(id);
    demo.simulateLaunch(id);
    demo.pauseCampaign(id);
    vi.advanceTimersByTime(10_000);
    const e = getDemoState().enrollments.find((x) => x.campaignId === id)!;
    expect(e.state).toBe("queued");
    expect(getDemoState().threads.some((t) => t.campaignId === id)).toBe(false);
  });

  it("suppression added after launch stops the queued send at dispatch time", () => {
    prepareLead();
    const id = readyCampaign();
    demo.approveCampaign(id);
    demo.simulateLaunch(id);
    demo.addSuppression(getBusiness(BLUE).contacts[0].email);
    vi.advanceTimersByTime(10_000);
    const e = getDemoState().enrollments.find((x) => x.campaignId === id)!;
    expect(e.state).toBe("stopped");
    expect(getDemoState().threads.some((t) => t.campaignId === id)).toBe(false);
  });

  it("prevents duplicate active outreach to the same lead across campaigns", () => {
    const s = getDemoState();
    const active = s.enrollments.find((e) => e.state === "sent")!;
    const id = demo.createCampaign("Duplicate", [active.leadId]);
    const r = evaluateRecipients(getDemoState(), campaign(id)).find((x) => x.leadId === active.leadId)!;
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/Already active/);
  });

  it("excludes catch-all addresses unless the policy allows them", () => {
    const leadId = "biz_dental_austin_1"; // fixture verification outcome: catch-all
    prepareLead(leadId);
    const id = readyCampaign([leadId]);
    expect(evaluateRecipients(getDemoState(), campaign(id))[0].reason).toMatch(/Catch-all/);
    demo.updateCampaign(id, { policy: { includeCatchAll: true, includeUnknown: false } });
    expect(evaluateRecipients(getDemoState(), campaign(id))[0].eligible).toBe(true);
  });
});

describe("suppression and import", () => {
  it("re-importing a suppressed address keeps it suppressed", () => {
    const email = getDemoState().suppression.find((x) => x.kind === "email")!.value;
    const domain = email.split("@")[1];
    demo.removeLeads(Object.keys(getDemoState().leads).filter((id) => getBusiness(id).domain === domain));
    const r = demo.importCsv(`name,website,email\nReimported,${domain},${email}`);
    expect(r.suppressed).toBe(1);
    expect(getDemoState().suppression.some((x) => x.value === email)).toBe(true);
  });

  it("deduplicates imports by domain", () => {
    demo.saveLeads([BLUE]);
    const r = demo.importCsv(`name,website\nBluebonnet,https://www.${getBusiness(BLUE).domain}/contact`);
    expect(r.duplicates).toBe(1);
    expect(r.added).toBe(0);
  });
});

describe("reset", () => {
  it("can start from an empty workspace", () => {
    demo.reset("empty");
    const s = getDemoState();
    expect(Object.keys(s.leads)).toHaveLength(0);
    expect(s.workspace.onboarded).toBe(false);
    expect(s.offer).toBeNull();
  });
});
