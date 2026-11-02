import type { Business, Contact } from "@/lib/domain/types";
import { demoAllowance } from "@/config/plans";
import { safeRate } from "@/lib/utils";
import { businessById } from "./fixtures/businesses";
import type { Campaign, DemoState, UsageKind } from "./types";

export function getBiz(s: DemoState, id: string): Business | undefined {
  return businessById.get(id) ?? s.importedBusinesses[id];
}

export function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}

export function normalizeDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function suppressionMatch(s: DemoState, email: string) {
  const e = normalizeEmail(email);
  const domain = e.split("@")[1] ?? "";
  return s.suppression.find((x) => (x.kind === "email" ? x.value === e : x.value === domain)) ?? null;
}

export type ContactView = Contact & { suppressed: boolean; verifying: boolean };

export function contactsOf(s: DemoState, b: Business): ContactView[] {
  return b.contacts.map((c) => {
    const o = s.contactOverrides[c.id];
    return {
      ...c,
      ...(o ? { status: o.status, verifiedAt: o.verifiedAt, verificationProvider: o.provider } : {}),
      suppressed: !!suppressionMatch(s, c.email),
      verifying: s.verifying.includes(c.id),
    };
  });
}

export function primaryContact(s: DemoState, b: Business): ContactView | null {
  return contactsOf(s, b)[0] ?? null;
}

export function usageSummary(s: DemoState) {
  const kinds: UsageKind[] = ["discovery", "verification", "ai"];
  const allowance: Record<UsageKind, number> = {
    discovery: demoAllowance.discoveryUnits,
    verification: demoAllowance.verificationUnits,
    ai: demoAllowance.aiUnits,
  };
  const out = {} as Record<UsageKind, { used: number; reserved: number; allowance: number; available: number }>;
  for (const k of kinds) {
    const entries = s.usage.filter((u) => u.kind === k);
    const used = entries.filter((u) => u.type === "charge").reduce((a, u) => a + u.units, 0);
    // A reservation is held until charges and releases with the same ref settle it.
    const reserved = entries
      .filter((u) => u.type === "reserve")
      .reduce((acc, r) => {
        const settled = entries.filter((u) => u.type !== "reserve" && u.ref === r.ref).reduce((a, u) => a + u.units, 0);
        return acc + Math.max(0, r.units - settled);
      }, 0);
    out[k] = { used, reserved, allowance: allowance[k], available: Math.max(0, allowance[k] - used - reserved) };
  }
  return out;
}

export type Eligibility = {
  leadId: string;
  name: string;
  email: string | null;
  contactId: string | null;
  eligible: boolean;
  reason: string | null;
};

/**
 * Who would actually be contacted. The same checks run again immediately
 * before each (simulated) dispatch.
 */
export function evaluateRecipients(s: DemoState, c: Campaign): Eligibility[] {
  return c.leadIds.map((leadId) => {
    const b = getBiz(s, leadId);
    const base = { leadId, name: b?.name ?? "Unknown business", email: null, contactId: null };
    if (!b) return { ...base, eligible: false, reason: "Lead no longer exists" };
    const contact = primaryContact(s, b);
    if (!contact) return { ...base, eligible: false, reason: "No email found" };
    const withEmail = { ...base, email: contact.email, contactId: contact.id };
    if (contact.suppressed) return { ...withEmail, eligible: false, reason: "On suppression list" };
    if (contact.status === "unverified") return { ...withEmail, eligible: false, reason: "Not verified yet" };
    if (contact.status === "invalid") return { ...withEmail, eligible: false, reason: "Invalid address" };
    if (contact.status === "catch_all" && !c.policy.includeCatchAll)
      return { ...withEmail, eligible: false, reason: "Catch-all (excluded by policy)" };
    if (contact.status === "unknown" && !c.policy.includeUnknown)
      return { ...withEmail, eligible: false, reason: "Unknown result (excluded by policy)" };
    const other = s.enrollments.find(
      (e) => e.leadId === leadId && e.campaignId !== c.id && (e.state === "queued" || e.state === "sent"),
    );
    if (other) {
      const oc = s.campaigns.find((x) => x.id === other.campaignId);
      return { ...withEmail, eligible: false, reason: `Already active in “${oc?.name ?? "another campaign"}”` };
    }
    if (s.threads.some((t) => t.leadId === leadId && t.messages.some((m) => m.direction === "inbound")))
      return { ...withEmail, eligible: false, reason: "Has already replied" };
    if (!s.drafts[leadId]) return { ...withEmail, eligible: false, reason: "No approved-ready draft yet" };
    return { ...withEmail, eligible: true, reason: null };
  });
}

export function approvalValid(c: Campaign) {
  return !!c.approval && c.approval.revision === c.revision;
}

export function campaignMetrics(s: DemoState, c: Campaign) {
  const enr = s.enrollments.filter((e) => e.campaignId === c.id);
  const sent = enr.filter((e) => e.state === "sent" || e.state === "replied" || (e.state === "stopped" && e.step > 0));
  const threads = s.threads.filter((t) => t.campaignId === c.id);
  const repliedLeads = new Set(threads.filter((t) => t.messages.some((m) => m.direction === "inbound" && !isAutoReply(t))).map((t) => t.leadId));
  const interested = threads.filter((t) => t.classification === "interested").length;
  return {
    queued: enr.filter((e) => e.state === "queued").length,
    sent: sent.length,
    replied: repliedLeads.size,
    interested,
    /** Unique human-reply recipients / unique recipients sent to. Null when nothing was sent. */
    replyRate: safeRate(repliedLeads.size, sent.length),
  };
}

function isAutoReply(t: { classification: string }) {
  return t.classification === "out_of_office";
}

export function leadStage(s: DemoState, id: string) {
  if (s.threads.some((t) => t.leadId === id && t.messages.some((m) => m.direction === "inbound"))) return "Replied";
  if (s.enrollments.some((e) => e.leadId === id && (e.state === "queued" || e.state === "sent"))) return "In sequence";
  if (s.campaigns.some((c) => c.leadIds.includes(id) && c.status === "draft")) return "In draft campaign";
  if (s.drafts[id]) return "Draft ready";
  if (s.briefs[id]) return "Researched";
  return "New";
}

export function briefIsStale(s: DemoState, id: string) {
  const b = s.briefs[id];
  return !!(b && s.offer && b.offerType !== s.offer.serviceType);
}
