import "server-only";
import { z } from "zod";
import { brand } from "@/config/brand";
import { aggregatePages, type ResearchedPage } from "@/lib/research/aggregate";
import { businessEmails, extractPage, pickFollowUpPages } from "@/lib/research/extract";
import { parseRobots, robotsAllows } from "@/lib/research/robots";
import { researchBusiness } from "@/lib/research/brief";
import type { OfferType } from "@/lib/domain/types";
import { requireWorkspace } from "@/server/auth";
import { withUser } from "@/server/db";
import { configuredSiteUrl } from "@/server/env";
import type { Q } from "@/server/auth-store";
import { contactById, leadDetail, recordDnsCheck, saveNotes, saveResearch, toBusiness, type ResearchOutcome } from "@/server/research-store";
import { safeFetch } from "@/server/research/fetch";
import { dnsEmailCheck } from "@/server/research/email-check";
import { getOfferProfile } from "@/server/services/workspaces";

const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));
const uuid = z.string().uuid();

export const RESEARCH_BUDGET_MS = 20_000;
const MAX_PAGES = 3;

function userAgent() {
  return `${brand.name}Bot/0.1 (+${configuredSiteUrl() ?? brand.siteUrl}; business research for outreach)`;
}

export async function getLeadDetail(leadId: string) {
  const { user } = await requireWorkspace("/app/leads");
  if (!uuid.safeParse(leadId).success) return null;
  return asQ(user.id, (q) => leadDetail(q, leadId));
}

/**
 * Reads up to three public pages of the lead's website (homepage first,
 * then contact/booking/forms pages it links to), within robots.txt, size
 * and time limits. Builds an Opportunity Brief for the current offer.
 * Uses no usage units: there is no paid provider involved.
 */
export async function researchLead(leadId: string): Promise<{ ok: true; status: ResearchOutcome["status"]; note: string } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/leads");
  if (!uuid.safeParse(leadId).success) return { ok: false, error: "Lead not found." };
  const offer = await getOfferProfile(workspace);
  if (!offer) return { ok: false, error: "Add your offer profile in Settings first. Research is scored against what you sell." };
  const detail = await asQ(user.id, (q) => leadDetail(q, leadId));
  if (!detail) return { ok: false, error: "Lead not found." };

  const now = new Date();
  const outcome = await readWebsite(detail.business.id, detail.business.website, detail.business.domain_normalized, now);
  const brief = { ...researchBusiness(toBusiness(detail, outcome.evidence, outcome.signals), offer.serviceType as OfferType, now.toISOString()), generator: "template" as const };
  await asQ(user.id, (q) => saveResearch(q, workspace.id, detail.business.id, outcome, brief, offer.serviceType));
  return { ok: true, status: outcome.status, note: outcome.note };
}

async function readWebsite(businessId: string, website: string | null, domain: string | null, now: Date): Promise<ResearchOutcome> {
  const empty = { signals: aggregatePages(businessId, [], now.toISOString(), () => crypto.randomUUID()).signals, evidence: [], emails: [] };
  if (!website) return { status: "no_website", note: "No website is listed for this business, so only the listing was used.", ...empty };

  const deadline = Date.now() + RESEARCH_BUDGET_MS;
  const ua = userAgent();
  const origin = new URL(website).origin;

  // robots.txt: 404 means no restrictions; an unreachable robots file means we don't crawl.
  const robots = await safeFetch(`${origin}/robots.txt`, { userAgent: ua, deadline, maxBytes: 64 * 1024, accept: "text/plain,*/*;q=0.1" });
  let rules: ReturnType<typeof parseRobots> = [];
  if (robots.ok) rules = parseRobots(robots.body, "LocentioBot");
  else if (!/^HTTP 4\d\d$/.test(robots.reason)) {
    return { status: "failed", note: `Couldn't reach the website (${robots.reason}).`, ...empty };
  }

  const pages: ResearchedPage[] = [];
  const skipped: string[] = [];
  const visit = async (url: string, role: ResearchedPage["role"]) => {
    const path = new URL(url).pathname || "/";
    if (!robotsAllows(rules, path)) {
      skipped.push(`${path} (robots.txt)`);
      return null;
    }
    const r = await safeFetch(url, { userAgent: ua, deadline, allowTypes: /text\/html|application\/xhtml\+xml/i });
    if (!r.ok) {
      skipped.push(`${path} (${r.reason})`);
      return null;
    }
    const page = extractPage(r.body, r.url, now);
    pages.push({ role, page });
    return page;
  };

  const home = await visit(website, "home");
  if (!home) {
    const blocked = skipped.some((s) => s.includes("robots.txt"));
    return { status: blocked ? "blocked" : "failed", note: blocked ? "The website's robots.txt asks automated tools not to read it." : `Couldn't read the homepage: ${skipped.join("; ")}.`, ...empty };
  }
  for (const url of pickFollowUpPages(home, MAX_PAGES - 1)) {
    if (Date.now() > deadline - 1500) break;
    await visit(url, "followup");
  }

  const { signals, evidence } = aggregatePages(businessId, pages, now.toISOString(), () => crypto.randomUUID());
  const emails = businessEmails(pages.flatMap((p) => p.page.emails), domain);
  const read = pages.map((p) => new URL(p.page.url).pathname || "/");
  return {
    status: skipped.length ? "partial" : "ok",
    note: `Read ${read.length} page${read.length === 1 ? "" : "s"}: ${read.join(", ")}.${skipped.length ? ` Skipped: ${skipped.join("; ")}.` : ""}`,
    signals,
    evidence,
    emails,
  };
}

/** Free DNS-based check. Can mark an address invalid; otherwise "unknown", never "valid". */
export async function checkContactEmail(contactId: string): Promise<{ ok: true; status: string; detail: string } | { ok: false; error: string }> {
  const { user } = await requireWorkspace("/app/leads");
  if (!uuid.safeParse(contactId).success) return { ok: false, error: "Contact not found." };
  const contact = await asQ(user.id, (q) => contactById(q, contactId));
  if (!contact) return { ok: false, error: "Contact not found." };
  const r = await dnsEmailCheck(contact.email_normalized);
  if (r.status === "error") return { ok: false, error: r.detail };
  const changed = await asQ(user.id, (q) => recordDnsCheck(q, contactId, r.status as "invalid" | "unknown", r.detail));
  return changed ? { ok: true, status: r.status, detail: r.detail } : { ok: false, error: "This address already has a result from a verification provider." };
}

export async function updateLeadNotes(leadId: string, notes: string) {
  const { user } = await requireWorkspace("/app/leads");
  if (!uuid.safeParse(leadId).success) return false;
  return asQ(user.id, (q) => saveNotes(q, leadId, String(notes ?? "")));
}
