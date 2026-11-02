"use client";

import { useSyncExternalStore } from "react";
import type { Business, DiscoveryFilters, OfferProfile } from "@/lib/domain/types";
import { businesses, fixtureVerificationOutcome } from "./fixtures/businesses";
import { researchBusiness } from "./research";
import { defaultFollowUps, generateDraft } from "./drafts";
import { canSearch, estimateMaxUnits, PAGE_SIZE, searchFixtures } from "./search";
import {
  approvalValid,
  evaluateRecipients,
  getBiz,
  normalizeDomain,
  normalizeEmail,
  primaryContact,
  suppressionMatch,
  usageSummary,
} from "./selectors";
import { DEMO_SCHEMA, DEMO_STORAGE_KEY, emptySeed, sampleSeed } from "./seed";
import { parseCsv } from "./csv";
import type {
  Campaign,
  Classification,
  DemoState,
  DiscoveryJob,
  Enrollment,
  Notice,
  Thread,
  UsageKind,
} from "./types";

/**
 * Client-only demo store.
 *
 * Everything here is simulated: no network request is made, no email is
 * delivered and nothing is charged. State persists in this browser's
 * localStorage under a demo-only key and can be reset at any time.
 *
 * Timers stand in for the durable jobs that M2 runs server-side. On reload,
 * work that was in flight is marked "interrupted" rather than silently
 * completed.
 */

const SERVER_SNAPSHOT: DemoState = sampleSeed();

let state: DemoState | null = null;
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let storageBound = false;

const now = () => new Date().toISOString();
let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function readStorage(): DemoState | null {
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoState;
    if (parsed?.schema !== DEMO_SCHEMA) return null;
    return parsed;
  } catch {
    return null;
  }
}

function recoverInterrupted(s: DemoState): DemoState {
  let next: DemoState = { ...s, verifying: [], researching: [], notices: [] };
  if (next.job && (next.job.status === "running" || next.job.status === "partial")) {
    next = finalizeJob(next, next.job, "interrupted");
  }
  return next;
}

function getState(): DemoState {
  if (state) return state;
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  state = recoverInterrupted(readStorage() ?? sampleSeed());
  // Resume simulated dispatch for campaigns that were running.
  queueMicrotask(resumeBackgroundWork);
  return state;
}

function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked: the demo keeps working in memory.
    }
  }, 120);
}

function emit() {
  listeners.forEach((l) => l());
}

function set(updater: (s: DemoState) => DemoState) {
  state = updater(getState());
  persist();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!storageBound && typeof window !== "undefined") {
    storageBound = true;
    window.addEventListener("storage", (e) => {
      if (e.key !== DEMO_STORAGE_KEY) return;
      const fromOtherTab = readStorage();
      if (fromOtherTab) {
        state = fromOtherTab;
        emit();
      }
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useDemo(): DemoState {
  return useSyncExternalStore(subscribe, getState, () => SERVER_SNAPSHOT);
}

export function getDemoState() {
  return getState();
}

/* ------------------------------------------------------------------ helpers */

function addActivity(s: DemoState, text: string, href?: string): DemoState {
  return { ...s, activity: [{ id: uid("act"), at: now(), text, href }, ...s.activity].slice(0, 40) };
}

function addNotice(s: DemoState, n: Omit<Notice, "id">): DemoState {
  return { ...s, notices: [...s.notices, { ...n, id: uid("n") }] };
}

function addUsage(s: DemoState, kind: UsageKind, type: "reserve" | "charge" | "release", units: number, ref: string, note: string): DemoState {
  if (units <= 0) return s;
  return { ...s, usage: [{ id: uid("u"), at: now(), kind, type, units, ref, note }, ...s.usage] };
}

function hasCharge(s: DemoState, ref: string) {
  return s.usage.some((u) => u.type === "charge" && u.ref === ref);
}

function schedule(key: string, ms: number, fn: () => void) {
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      fn();
    }, ms),
  );
}

function clearAllTimers() {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
}

function bumpCampaign(c: Campaign, patch: Partial<Campaign> = {}): Campaign {
  return { ...c, ...patch, revision: c.revision + 1, updatedAt: now() };
}

/* ---------------------------------------------------------------- discovery */

function finalizeJob(s: DemoState, job: DiscoveryJob, status: DiscoveryJob["status"]): DemoState {
  const charged = job.resultIds.length;
  let next: DemoState = {
    ...s,
    job: { ...job, status, chargedUnits: charged, finishedAt: now(), error: status === "interrupted" ? "The page was reloaded while this search ran. Results collected before that are kept." : job.error },
  };
  next = addUsage(next, "discovery", "charge", charged, job.id, `Search: ${job.query || "structured filters"} (${charged} returned)`);
  next = addUsage(next, "discovery", "release", job.reservedUnits - charged, job.id, "Unused reservation returned");
  next = { ...next, progress: { ...next.progress, searched: next.progress.searched || charged > 0 } };
  return next;
}

function runNextPage(jobId: string) {
  schedule(`job:${jobId}`, 650 + Math.round(Math.random() * 350), () => {
    let again = false;
    set((s) => {
      const job = s.job;
      if (!job || job.id !== jobId || job.status !== "running") return s;
      const page = job.pages.find((p) => p.status === "pending");
      if (!page) return finalizeJob(s, job, "completed");
      const failHere = job.failNextPage && page.index === Math.min(1, job.totalPages - 1);
      if (failHere) {
        const pages = job.pages.map((p) => (p.index === page.index ? { ...p, status: "failed" as const } : p));
        return {
          ...s,
          job: {
            ...job,
            pages,
            failNextPage: false,
            status: "partial",
            error: `The provider timed out on page ${page.index + 1}. ${job.resultIds.length} results so far are kept and that page was not charged.`,
          },
        };
      }
      const pages = job.pages.map((p) => (p.index === page.index ? { ...p, status: "done" as const } : p));
      const updated: DiscoveryJob = { ...job, pages, resultIds: [...job.resultIds, ...page.ids] };
      if (pages.every((p) => p.status === "done")) {
        const done = finalizeJob({ ...s, job: updated }, updated, "completed");
        return addActivity(done, `Search finished: ${updated.resultIds.length} businesses for “${job.query || "filters"}”.`, "/demo/discover");
      }
      again = true;
      return { ...s, job: updated };
    });
    if (again) runNextPage(jobId);
  });
}

/* -------------------------------------------------------------- dispatching */

function dispatchLoop(campaignId: string) {
  schedule(`dispatch:${campaignId}`, 1100, () => {
    let again = false;
    let replyFor: string | null = null;
    set((s) => {
      const c = s.campaigns.find((x) => x.id === campaignId);
      if (!c || c.status !== "running") return s;
      const enr = s.enrollments.find((e) => e.campaignId === campaignId && e.state === "queued");
      if (!enr) return s;

      // Re-check everything immediately before the (simulated) dispatch.
      const check = evaluateRecipients(s, c).find((x) => x.leadId === enr.leadId);
      const reason = !approvalValid(c) ? "Approval no longer valid" : !check?.eligible ? check?.reason ?? "Not eligible" : null;
      if (reason) {
        again = s.enrollments.some((e) => e.campaignId === campaignId && e.state === "queued" && e.id !== enr.id);
        return {
          ...s,
          enrollments: s.enrollments.map((e) => (e.id === enr.id ? { ...e, state: "stopped", reason: `Skipped before sending: ${reason}`, updatedAt: now() } : e)),
        };
      }

      const b = getBiz(s, enr.leadId)!;
      const draft = s.drafts[enr.leadId]!;
      const from = senderAddress(s);
      const thread: Thread = {
        id: uid("thread"),
        leadId: enr.leadId,
        campaignId,
        subject: draft.subject,
        isSample: c.isSample,
        classification: "unclassified",
        classificationSource: "suggested",
        suggestionConfidence: "low",
        unread: false,
        replyDraft: null,
        messages: [
          { id: uid("msg"), direction: "outbound", at: now(), from, to: check!.email!, subject: draft.subject, body: draft.body, simulated: true },
        ],
      };
      const enrollments = s.enrollments.map((e) => (e.id === enr.id ? { ...e, state: "sent" as const, step: 1, reason: null, updatedAt: now() } : e));
      const firstSend = !s.enrollments.some((e) => e.campaignId === campaignId && e.state !== "queued" && e.step > 0);
      if (firstSend && !c.isSample) replyFor = enr.leadId;
      again = enrollments.some((e) => e.campaignId === campaignId && e.state === "queued");
      let next: DemoState = { ...s, enrollments, threads: [thread, ...s.threads] };
      next = addActivity(next, `Simulated send to ${b.name}. Nothing was delivered.`, "/demo/campaigns");
      return next;
    });
    if (again) dispatchLoop(campaignId);
    if (replyFor) {
      const leadId = replyFor;
      schedule(`reply:${campaignId}`, 3200, () => simulateReply(campaignId, leadId));
    }
  });
}

function senderAddress(s: DemoState) {
  const name = (s.offer?.senderName || "you").split(" ")[0].toLowerCase().replace(/[^a-z]/g, "") || "you";
  const company = (s.offer?.companyName || s.workspace.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${name}@${company || "workspace"}.example`;
}

export function classifyReply(body: string): { classification: Classification; confidence: "high" | "medium" | "low" } {
  const t = body.toLowerCase();
  if (/out of (the )?office|office is closed|reopen|away until|on leave|auto-?reply/.test(t)) return { classification: "out_of_office", confidence: "medium" };
  if (/not interested|take us off|remove (us|me)|unsubscribe|no thanks|stop emailing/.test(t)) return { classification: "not_interested", confidence: "high" };
  if (/interested|set up a call|times? (for|that)|sounds good|tell me more|what would|send (over|me)|let's talk/.test(t)) return { classification: "interested", confidence: "high" };
  return { classification: "unclassified", confidence: "low" };
}

function simulateReply(campaignId: string, leadId: string) {
  set((s) => {
    const thread = s.threads.find((t) => t.campaignId === campaignId && t.leadId === leadId);
    if (!thread || thread.messages.some((m) => m.direction === "inbound")) return s;
    const b = getBiz(s, leadId);
    const firstName = (s.offer?.senderName || "there").split(" ")[0];
    const body = `Hi ${firstName},\n\nThanks for reaching out. The timing is actually good: it's been on our list for a while. Could you send over a couple of times for a quick call next week?\n\nBest,\n${b?.name ?? "The team"} front desk`;
    const { classification, confidence } = classifyReply(body);
    const msg = {
      id: uid("msg"),
      direction: "inbound" as const,
      at: now(),
      from: thread.messages[0].to,
      to: thread.messages[0].from,
      subject: `Re: ${thread.subject}`,
      body,
      simulated: true as const,
    };
    let next: DemoState = {
      ...s,
      threads: s.threads.map((t) =>
        t.id === thread.id ? { ...t, messages: [...t.messages, msg], classification, classificationSource: "suggested", suggestionConfidence: confidence, unread: true } : t,
      ),
      enrollments: s.enrollments.map((e) =>
        e.campaignId === campaignId && e.leadId === leadId ? { ...e, state: "replied", reason: "Replied. Follow-ups stopped.", updatedAt: now() } : e,
      ),
    };
    next = addActivity(next, `Simulated reply from ${b?.name}. Follow-ups for this lead stopped.`, "/demo/inbox");
    next = addNotice(next, { tone: "info", title: "Simulated reply received", body: `${b?.name} replied. Follow-ups for this lead were stopped. Open the Inbox to review it.` });
    return next;
  });
}

function resumeBackgroundWork() {
  const s = getState();
  for (const c of s.campaigns) {
    if (c.status !== "running") continue;
    if (s.enrollments.some((e) => e.campaignId === c.id && e.state === "queued")) dispatchLoop(c.id);
    if (!c.isSample) {
      const threads = s.threads.filter((t) => t.campaignId === c.id);
      const anyInbound = threads.some((t) => t.messages.some((m) => m.direction === "inbound"));
      const firstSent = s.enrollments.find((e) => e.campaignId === c.id && e.state === "sent");
      if (!anyInbound && firstSent) schedule(`reply:${c.id}`, 2500, () => simulateReply(c.id, firstSent.leadId));
    }
  }
}

/* ------------------------------------------------------------------ actions */

export const demo = {
  reset(mode: "sample" | "empty") {
    clearAllTimers();
    state = mode === "sample" ? sampleSeed() : emptySeed();
    persist();
    emit();
  },

  consumeNotice(id: string) {
    set((s) => ({ ...s, notices: s.notices.filter((n) => n.id !== id) }));
  },

  /* Workspace & onboarding */
  completeOnboarding(workspaceName: string, offer: OfferProfile) {
    set((s) => addActivity({ ...s, workspace: { name: workspaceName, onboarded: true }, offer }, "Workspace set up. Offer profile saved.", "/demo/settings"));
  },
  updateWorkspaceName(name: string) {
    set((s) => ({ ...s, workspace: { ...s.workspace, name } }));
  },
  updateOffer(offer: OfferProfile) {
    set((s) => {
      const changedType = s.offer?.serviceType !== offer.serviceType;
      let next: DemoState = { ...s, offer, workspace: { ...s.workspace, onboarded: true } };
      next = addActivity(next, changedType ? "Offer type changed. Existing briefs are marked for re-research." : "Offer profile updated.", "/demo/settings");
      return next;
    });
  },

  /* Discovery */
  startSearch(query: string, filters: DiscoveryFilters, opts: { failNextPage?: boolean } = {}): { ok: boolean; reason?: string } {
    const s = getState();
    const valid = canSearch(filters);
    if (!valid.ok) return { ok: false, reason: valid.reason };
    if (s.job?.status === "running") return { ok: false, reason: "A search is already running." };
    const estimate = estimateMaxUnits(filters);
    const avail = usageSummary(s).discovery.available;
    if (estimate > avail) return { ok: false, reason: `This search could use up to ${estimate} discovery units but ${avail} are available. Lower the maximum results.` };
    const ids = searchFixtures(filters).map((b) => b.id);
    const pages = Array.from({ length: Math.ceil(ids.length / PAGE_SIZE) }, (_, i) => ({
      index: i,
      status: "pending" as const,
      ids: ids.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE),
    }));
    const job: DiscoveryJob = {
      id: uid("job"),
      query,
      filters,
      status: "running",
      totalPages: pages.length,
      pages,
      resultIds: [],
      error: null,
      reservedUnits: estimate,
      chargedUnits: 0,
      startedAt: now(),
      finishedAt: null,
      failNextPage: !!opts.failNextPage && pages.length > 0,
    };
    set((st) => addUsage({ ...st, job }, "discovery", "reserve", estimate, job.id, `Reserved for search: ${query || "filters"}`));
    runNextPage(job.id);
    return { ok: true };
  },
  retryFailedPage() {
    const s = getState();
    if (!s.job || s.job.status !== "partial") return;
    const id = s.job.id;
    set((st) => ({
      ...st,
      job: st.job && { ...st.job, status: "running", error: null, pages: st.job.pages.map((p) => (p.status === "failed" ? { ...p, status: "pending" } : p)) },
    }));
    runNextPage(id);
  },
  finishWithPartial() {
    set((s) => (s.job && s.job.status === "partial" ? finalizeJob(s, s.job, "partial") : s));
  },
  cancelSearch() {
    const s = getState();
    if (!s.job) return;
    const t = timers.get(`job:${s.job.id}`);
    if (t) clearTimeout(t);
    set((st) => (st.job && (st.job.status === "running" || st.job.status === "partial") ? finalizeJob(st, st.job, "cancelled") : st));
  },
  clearSearch() {
    set((s) => (s.job && s.job.status === "running" ? s : { ...s, job: null }));
  },

  /* Leads */
  saveLeads(ids: string[], listId?: string): { added: number; duplicates: number } {
    let added = 0;
    let duplicates = 0;
    set((s) => {
      const leads = { ...s.leads };
      for (const id of ids) {
        if (leads[id]) {
          duplicates++;
          if (listId && !leads[id].listIds.includes(listId)) leads[id] = { ...leads[id], listIds: [...leads[id].listIds, listId] };
          continue;
        }
        leads[id] = { businessId: id, savedAt: now(), source: "search", listIds: listId ? [listId] : [], tags: [], notes: "" };
        added++;
      }
      return added ? addActivity({ ...s, leads }, `Saved ${added} lead${added === 1 ? "" : "s"}.`, "/demo/leads") : { ...s, leads };
    });
    return { added, duplicates };
  },
  removeLeads(ids: string[]): { removed: number; blocked: number } {
    let removed = 0;
    let blocked = 0;
    set((s) => {
      const leads = { ...s.leads };
      const removedIds: string[] = [];
      for (const id of ids) {
        const active = s.enrollments.some((e) => e.leadId === id && (e.state === "queued" || e.state === "sent"));
        if (active) {
          blocked++;
          continue;
        }
        if (leads[id]) {
          delete leads[id];
          removedIds.push(id);
          removed++;
        }
      }
      const campaigns = s.campaigns.map((c) =>
        c.status === "draft" && c.leadIds.some((l) => removedIds.includes(l)) ? bumpCampaign(c, { leadIds: c.leadIds.filter((l) => !removedIds.includes(l)) }) : c,
      );
      return { ...s, leads, campaigns };
    });
    return { removed, blocked };
  },
  createList(name: string): string {
    const id = uid("list");
    set((s) => ({ ...s, lists: [...s.lists, { id, name: name.trim(), createdAt: now() }] }));
    return id;
  },
  addToList(ids: string[], listId: string) {
    set((s) => {
      const leads = { ...s.leads };
      for (const id of ids) if (leads[id] && !leads[id].listIds.includes(listId)) leads[id] = { ...leads[id], listIds: [...leads[id].listIds, listId] };
      return { ...s, leads };
    });
  },
  removeFromList(id: string, listId: string) {
    set((s) => (s.leads[id] ? { ...s, leads: { ...s.leads, [id]: { ...s.leads[id], listIds: s.leads[id].listIds.filter((l) => l !== listId) } } } : s));
  },
  addTag(ids: string[], tag: string) {
    const t = tag.trim().toLowerCase();
    if (!t) return;
    set((s) => {
      const leads = { ...s.leads };
      for (const id of ids) if (leads[id] && !leads[id].tags.includes(t)) leads[id] = { ...leads[id], tags: [...leads[id].tags, t] };
      return { ...s, leads };
    });
  },
  removeTag(id: string, tag: string) {
    set((s) => (s.leads[id] ? { ...s, leads: { ...s.leads, [id]: { ...s.leads[id], tags: s.leads[id].tags.filter((t) => t !== tag) } } } : s));
  },
  setNotes(id: string, notes: string) {
    set((s) => (s.leads[id] ? { ...s, leads: { ...s.leads, [id]: { ...s.leads[id], notes } } } : s));
  },
  importCsv(text: string) {
    const parsed = parseCsv(text);
    const summary = { added: 0, duplicates: 0, suppressed: 0, skipped: parsed.errors.length, errors: parsed.errors };
    if (!parsed.rows.length) return summary;
    set((s) => {
      const leads = { ...s.leads };
      const imported = { ...s.importedBusinesses };
      // Match by normalized domain against known businesses so re-imports deduplicate.
      const known = new Map<string, string>();
      for (const b of businesses) if (b.domain) known.set(b.domain, b.id);
      for (const b of Object.values(imported)) if (b.domain) known.set(b.domain, b.id);
      for (const row of parsed.rows) {
        const domain = row.website ? normalizeDomain(row.website) : row.email ? row.email.split("@")[1] : null;
        if (row.email && suppressionMatch(s, row.email)) summary.suppressed++;
        const existing = domain ? known.get(domain) : undefined;
        if (existing && leads[existing]) {
          summary.duplicates++;
          continue;
        }
        const id = existing ?? uid("imp");
        if (!existing) {
          const biz: Business = {
            id,
            name: row.name,
            niche: "dental",
            city: row.city || "Unknown",
            region: "",
            address: row.city ? `${row.city}` : "Unknown",
            phone: row.phone || "Unknown",
            website: domain && row.website ? `https://${domain}` : null,
            domain,
            rating: null,
            reviewCount: null,
            distanceMi: 0,
            provider: { name: "CSV import", ref: `csv:${row.line}` },
            collectedAt: now(),
            signals: { siteCopyrightYear: null, mobileViewport: null, onlineBooking: null, intakeMethod: null, ownerReplyShare: null, hoursListed: null, photoCount: null, contactForm: null },
            evidence: [{ id: `${id}_ev_import`, businessId: id, kind: "listing", label: "CSV import", url: "csv://import", collectedAt: now(), excerpt: `Imported row ${row.line}` }],
            contacts: row.email
              ? [{ id: `${id}_c0`, businessId: id, email: normalizeEmail(row.email), kind: "role", sourceEvidenceId: `${id}_ev_import`, status: "unverified", verifiedAt: null, verificationProvider: null }]
              : [],
          };
          imported[id] = biz;
          if (domain) known.set(domain, id);
        }
        leads[id] = { businessId: id, savedAt: now(), source: "import", listIds: [], tags: ["imported"], notes: "" };
        summary.added++;
      }
      return addActivity({ ...s, leads, importedBusinesses: imported }, `Imported ${summary.added} leads from CSV (${summary.duplicates} duplicates skipped).`, "/demo/leads");
    });
    return summary;
  },

  /* Research & verification */
  research(id: string): { ok: boolean; reason?: string } {
    const s = getState();
    if (!s.offer) return { ok: false, reason: "Set up your offer profile first. Research is matched to what you sell." };
    if (s.researching.includes(id)) return { ok: true };
    if (usageSummary(s).ai.available < 1) return { ok: false, reason: "No AI units left in the demo allowance. Reset the demo to continue." };
    set((st) => ({
      ...st,
      researching: [...st.researching, id],
      leads: st.leads[id] ? st.leads : { ...st.leads, [id]: { businessId: id, savedAt: now(), source: "search", listIds: [], tags: [], notes: "" } },
    }));
    schedule(`research:${id}`, 1300, () => {
      set((st) => {
        const b = getBiz(st, id);
        if (!b || !st.offer) return { ...st, researching: st.researching.filter((x) => x !== id) };
        const brief = researchBusiness(b, st.offer.serviceType, now());
        let next: DemoState = { ...st, briefs: { ...st.briefs, [id]: brief }, researching: st.researching.filter((x) => x !== id) };
        next = addUsage(next, "ai", "charge", 1, `brief_${id}_${Date.now()}`, `Opportunity Brief: ${b.name}`);
        return addActivity(next, `Researched ${b.name}: ${brief.fit.level} fit, ${brief.confidence.level} confidence.`, "/demo/leads");
      });
    });
    return { ok: true };
  },
  markEvidenceInspected() {
    const s = getState();
    if (!s.progress.inspectedEvidence) set((st) => ({ ...st, progress: { ...st.progress, inspectedEvidence: true } }));
  },
  verify(contactIds: string[]): { ok: boolean; reason?: string } {
    const s = getState();
    const todo = contactIds.filter((cid) => !s.verifying.includes(cid) && (s.contactOverrides[cid]?.status ?? "unverified") === "unverified");
    if (!todo.length) return { ok: true };
    if (usageSummary(s).verification.available < todo.length) return { ok: false, reason: "Not enough verification units in the demo allowance." };
    set((st) => ({ ...st, verifying: [...st.verifying, ...todo] }));
    todo.forEach((cid, i) => {
      schedule(`verify:${cid}`, 900 + i * 250, () => {
        set((st) => {
          const status = fixtureVerificationOutcome.get(cid) ?? "unknown";
          let next: DemoState = {
            ...st,
            verifying: st.verifying.filter((x) => x !== cid),
            contactOverrides: { ...st.contactOverrides, [cid]: { status, verifiedAt: now(), provider: "Demo verifier" } },
          };
          // Idempotent: one charge per address check, even if retried.
          const ref = `verify_${cid}`;
          if (!hasCharge(next, ref)) next = addUsage(next, "verification", "charge", 1, ref, `Checked 1 address (${status.replace("_", "-")})`);
          return next;
        });
      });
    });
    return { ok: true };
  },

  /* Drafts */
  generateDraft(id: string, variant?: number): { ok: boolean; reason?: string } {
    const s = getState();
    const b = getBiz(s, id);
    const brief = s.briefs[id];
    if (!b || !brief) return { ok: false, reason: "Research this lead first. Drafts are built from its Opportunity Brief." };
    if (!s.offer) return { ok: false, reason: "Set up your offer profile first." };
    if (usageSummary(s).ai.available < 1) return { ok: false, reason: "No AI units left in the demo allowance." };
    const prev = s.drafts[id];
    const v = variant ?? (prev ? prev.variant + 1 : 0);
    const d = generateDraft(b, brief, s.offer, v);
    set((st) => {
      const version = (prev?.version ?? 0) + 1;
      const at = now();
      let next: DemoState = {
        ...st,
        drafts: {
          ...st.drafts,
          [id]: {
            id: prev?.id ?? uid("draft"),
            leadId: id,
            version,
            subject: d.subject,
            body: d.body,
            factIds: d.factIds,
            origin: "generated",
            variant: v,
            updatedAt: at,
            history: [...(prev?.history ?? []), { version, subject: d.subject, body: d.body, at, origin: "generated" as const }].slice(-10),
          },
        },
        progress: { ...st.progress, generatedDraft: true },
      };
      next = addUsage(next, "ai", "charge", 1, `draft_${id}_${version}`, `Draft v${version}: ${b.name}`);
      return invalidateFor(next, id, "A draft was regenerated");
    });
    return { ok: true };
  },
  saveDraft(id: string, subject: string, body: string) {
    set((st) => {
      const prev = st.drafts[id];
      if (!prev || (prev.subject === subject && prev.body === body)) return st;
      const version = prev.version + 1;
      const at = now();
      const next: DemoState = {
        ...st,
        drafts: {
          ...st.drafts,
          [id]: { ...prev, version, subject, body, origin: "edited", updatedAt: at, history: [...prev.history, { version, subject, body, at, origin: "edited" as const }].slice(-10) },
        },
        progress: { ...st.progress, editedDraft: true },
      };
      return invalidateFor(next, id, "A draft was edited");
    });
  },

  /* Campaigns */
  createCampaign(name: string, leadIds: string[]): string {
    const id = uid("camp");
    set((s) => {
      const c: Campaign = {
        id,
        name: name.trim() || "Untitled campaign",
        isSample: false,
        status: "draft",
        createdAt: now(),
        updatedAt: now(),
        launchedAt: null,
        leadIds: Array.from(new Set(leadIds)),
        offerSnapshot: s.offer?.service ?? "",
        steps: [
          { id: uid("step"), kind: "initial", delayDays: 0, subject: "Personal draft per lead", body: "" },
          ...defaultFollowUps.map((f) => ({ id: uid("step"), kind: "follow_up" as const, ...f })),
        ],
        mailboxId: null,
        schedule: { timezone: "America/Chicago", days: [1, 2, 3, 4, 5], startHour: 9, endHour: 16, dailyCap: 25 },
        policy: { includeCatchAll: false, includeUnknown: false },
        revision: 1,
        approval: null,
      };
      let next: DemoState = { ...s, campaigns: [c, ...s.campaigns] };
      if (leadIds.length) next = { ...next, progress: { ...next.progress, addedToCampaign: true } };
      return addActivity(next, `Created draft campaign “${c.name}”.`, "/demo/campaigns");
    });
    return id;
  },
  addToCampaign(campaignId: string, leadIds: string[]): { ok: boolean; reason?: string } {
    const c = getState().campaigns.find((x) => x.id === campaignId);
    if (!c) return { ok: false, reason: "Campaign not found." };
    if (c.status !== "draft" && c.status !== "paused") return { ok: false, reason: "Only draft or paused campaigns can take new recipients." };
    set((s) => {
      const campaigns = s.campaigns.map((x) =>
        x.id === campaignId ? bumpCampaign(x, { leadIds: Array.from(new Set([...x.leadIds, ...leadIds])) }) : x,
      );
      return addActivity({ ...s, campaigns, progress: { ...s.progress, addedToCampaign: true } }, `Added ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"} to “${c.name}”.`, "/demo/campaigns");
    });
    return { ok: true };
  },
  removeFromCampaign(campaignId: string, leadId: string) {
    set((s) => ({
      ...s,
      campaigns: s.campaigns.map((c) => (c.id === campaignId && (c.status === "draft" || c.status === "paused") ? bumpCampaign(c, { leadIds: c.leadIds.filter((l) => l !== leadId) }) : c)),
    }));
  },
  updateCampaign(id: string, patch: Partial<Pick<Campaign, "name" | "steps" | "mailboxId" | "schedule" | "policy">>) {
    set((s) => ({
      ...s,
      campaigns: s.campaigns.map((c) => {
        if (c.id !== id) return c;
        const contentChange = Object.keys(patch).some((k) => k !== "name");
        if (!contentChange) return { ...c, ...patch, updatedAt: now() };
        const bumped = bumpCampaign(c, patch);
        return bumped.status === "running" ? { ...bumped, status: "paused" } : bumped;
      }),
    }));
  },
  approveCampaign(id: string): { ok: boolean; reason?: string } {
    const s = getState();
    const c = s.campaigns.find((x) => x.id === id);
    if (!c) return { ok: false, reason: "Campaign not found." };
    if (!c.mailboxId) return { ok: false, reason: "Choose a sending mailbox first." };
    const elig = evaluateRecipients(s, c).filter((e) => e.eligible);
    if (!elig.length) return { ok: false, reason: "No eligible recipients. Verify addresses and make sure each lead has a draft." };
    if (c.steps.some((st) => st.kind === "follow_up" && (!st.subject.trim() || !st.body.trim()))) return { ok: false, reason: "Every follow-up needs a subject and body." };
    set((st) => ({
      ...st,
      campaigns: st.campaigns.map((x) =>
        x.id === id
          ? {
              ...x,
              approval: {
                revision: x.revision,
                approvedAt: now(),
                recipientIds: elig.map((e) => e.leadId),
                draftVersions: Object.fromEntries(elig.map((e) => [e.leadId, st.drafts[e.leadId]?.version ?? 0])),
              },
            }
          : x,
      ),
    }));
    return { ok: true };
  },
  simulateLaunch(id: string): { ok: boolean; reason?: string } {
    const s = getState();
    const c = s.campaigns.find((x) => x.id === id);
    if (!c) return { ok: false, reason: "Campaign not found." };
    if (c.status !== "draft") return { ok: false, reason: "Only draft campaigns can be launched." };
    if (!approvalValid(c)) return { ok: false, reason: "Approve the current version first." };
    set((st) => {
      const enrollments: Enrollment[] = c.approval!.recipientIds.map((leadId) => {
        const b = getBiz(st, leadId)!;
        return { id: uid("enr"), campaignId: id, leadId, contactId: primaryContact(st, b)?.id ?? "", state: "queued", reason: null, step: 0, updatedAt: now() };
      });
      let next: DemoState = {
        ...st,
        enrollments: [...st.enrollments.filter((e) => e.campaignId !== id), ...enrollments],
        campaigns: st.campaigns.map((x) => (x.id === id ? { ...x, status: "running", launchedAt: now(), updatedAt: now() } : x)),
        progress: { ...st.progress, simulatedLaunch: true },
      };
      next = addActivity(next, `Simulated launch of “${c.name}” to ${enrollments.length} recipient${enrollments.length === 1 ? "" : "s"}. No email was sent.`, "/demo/campaigns");
      return next;
    });
    dispatchLoop(id);
    return { ok: true };
  },
  pauseCampaign(id: string) {
    set((s) => addActivity({ ...s, campaigns: s.campaigns.map((c) => (c.id === id && c.status === "running" ? { ...c, status: "paused", updatedAt: now() } : c)) }, "Campaign paused. Queued messages will not be dispatched.", "/demo/campaigns"));
  },
  resumeCampaign(id: string): { ok: boolean; reason?: string } {
    const c = getState().campaigns.find((x) => x.id === id);
    if (!c || c.status !== "paused") return { ok: false, reason: "Campaign is not paused." };
    if (!approvalValid(c)) return { ok: false, reason: "Content or recipients changed since approval. Review and approve again before resuming." };
    set((s) => ({ ...s, campaigns: s.campaigns.map((x) => (x.id === id ? { ...x, status: "running", updatedAt: now() } : x)) }));
    dispatchLoop(id);
    return { ok: true };
  },
  cancelCampaign(id: string) {
    const t = timers.get(`dispatch:${id}`);
    if (t) clearTimeout(t);
    set((s) => ({
      ...s,
      campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, status: "cancelled", updatedAt: now() } : c)),
      enrollments: s.enrollments.map((e) => (e.campaignId === id && e.state === "queued" ? { ...e, state: "stopped", reason: "Campaign cancelled", updatedAt: now() } : e)),
    }));
  },
  deleteCampaign(id: string) {
    set((s) => ({ ...s, campaigns: s.campaigns.filter((c) => !(c.id === id && c.status === "draft")) }));
  },

  /* Inbox */
  openThread(id: string) {
    set((s) => {
      const t = s.threads.find((x) => x.id === id);
      if (!t) return s;
      const viewedReply = s.progress.viewedReply || (!t.isSample && t.messages.some((m) => m.direction === "inbound"));
      return { ...s, threads: s.threads.map((x) => (x.id === id ? { ...x, unread: false } : x)), progress: { ...s.progress, viewedReply } };
    });
  },
  setClassification(id: string, classification: Classification) {
    set((s) => ({ ...s, threads: s.threads.map((t) => (t.id === id ? { ...t, classification, classificationSource: "user" } : t)) }));
  },
  suggestReply(id: string): { ok: boolean; reason?: string } {
    const s = getState();
    const t = s.threads.find((x) => x.id === id);
    if (!t) return { ok: false, reason: "Thread not found." };
    if (usageSummary(s).ai.available < 1) return { ok: false, reason: "No AI units left in the demo allowance." };
    const sign = s.offer?.senderName ? `\n\n${s.offer.senderName}` : "";
    const text: Record<Classification, string> = {
      interested: `Thanks for getting back to me. Happy to keep it short. Would Tuesday at 10am or Wednesday at 2pm work for a 15-minute call?${s.offer?.bookingLink ? ` If neither suits, you can pick a time here: ${s.offer.bookingLink}` : ""}${sign}`,
      not_interested: `Understood, thanks for letting me know. I've removed you from my list and won't follow up.${sign}`,
      out_of_office: `No reply needed: this looks like an automatic out-of-office message. Consider rescheduling the next follow-up for after the return date.`,
      unclassified: `Thanks for the reply. Could you tell me a little more about what you're looking for?${sign}`,
    };
    set((st) => addUsage({ ...st, threads: st.threads.map((x) => (x.id === id ? { ...x, replyDraft: text[x.classification] } : x)) }, "ai", "charge", 1, `reply_${id}_${Date.now()}`, "Suggested reply"));
    return { ok: true };
  },
  updateReplyDraft(id: string, text: string | null) {
    set((s) => ({ ...s, threads: s.threads.map((t) => (t.id === id ? { ...t, replyDraft: text } : t)) }));
  },
  recordReply(id: string) {
    set((s) => {
      const t = s.threads.find((x) => x.id === id);
      if (!t?.replyDraft?.trim()) return s;
      const last = t.messages[t.messages.length - 1];
      const msg = {
        id: uid("msg"),
        direction: "outbound" as const,
        at: now(),
        from: last.direction === "inbound" ? last.to : last.from,
        to: last.direction === "inbound" ? last.from : last.to,
        subject: `Re: ${t.subject}`,
        body: t.replyDraft,
        simulated: true as const,
      };
      return addNotice(
        { ...s, threads: s.threads.map((x) => (x.id === id ? { ...x, messages: [...x.messages, msg], replyDraft: null } : x)) },
        { tone: "info", title: "Reply recorded in the demo", body: "Nothing was sent. In the private beta, replies go out from your connected mailbox." },
      );
    });
  },

  /* Suppression */
  addSuppression(value: string, note = "", reason: "manual" | "unsubscribe" = "manual"): { ok: boolean; reason?: string } {
    const raw = value.trim().toLowerCase();
    const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw);
    const isDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(normalizeDomain(raw));
    if (!isEmail && !isDomain) return { ok: false, reason: "Enter an email address or a domain like example.com." };
    const v = isEmail ? raw : normalizeDomain(raw);
    if (getState().suppression.some((x) => x.value === v)) return { ok: false, reason: "Already on the suppression list." };
    set((s) => {
      let next: DemoState = {
        ...s,
        suppression: [{ id: uid("sup"), value: v, kind: isEmail ? "email" : "domain", reason, addedAt: now(), note }, ...s.suppression],
      };
      // Takes effect immediately for queued work.
      next = {
        ...next,
        enrollments: next.enrollments.map((e) => {
          if (e.state !== "queued" && e.state !== "sent") return e;
          const b = getBiz(next, e.leadId);
          const c = b && primaryContact(next, b);
          return c?.suppressed ? { ...e, state: "stopped", reason: "Suppressed", updatedAt: now() } : e;
        }),
      };
      return addActivity(next, `Added ${v} to the suppression list.`, "/demo/settings?tab=suppression");
    });
    return { ok: true };
  },
  removeSuppression(id: string) {
    set((s) => ({ ...s, suppression: s.suppression.filter((x) => x.id !== id) }));
  },
};

/** Editing content a campaign relies on invalidates its approval and pauses it if running. */
function invalidateFor(s: DemoState, leadId: string, why: string): DemoState {
  let paused = false;
  const campaigns = s.campaigns.map((c) => {
    if (!c.leadIds.includes(leadId) || c.status === "completed" || c.status === "cancelled") return c;
    const hasQueued = s.enrollments.some((e) => e.campaignId === c.id && e.leadId === leadId && e.state === "queued");
    if (c.status === "running" && !hasQueued) return c;
    const bumped = bumpCampaign(c);
    if (bumped.status === "running") {
      paused = true;
      return { ...bumped, status: "paused" as const };
    }
    return bumped;
  });
  let next = { ...s, campaigns };
  if (paused) next = addNotice(next, { tone: "info", title: "Campaign paused", body: `${why} after approval. Review and approve again to resume.` });
  return next;
}
