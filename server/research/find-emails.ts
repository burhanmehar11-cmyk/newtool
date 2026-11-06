import "server-only";
import { brand } from "@/config/brand";
import { businessEmails, extractPage, pickContactPages } from "@/lib/research/extract";
import { parseRobots, robotsAllows } from "@/lib/research/robots";
import { normalizeWebsite } from "@/lib/discovery/osm";
import { configuredSiteUrl } from "@/server/env";
import { safeFetch } from "@/server/research/fetch";

/**
 * Finds public email addresses a business shows on its own website: the
 * homepage, then up to three contact/impressum/about/privacy pages it links to. Respects
 * robots.txt, uses the SSRF-safe fetcher, and stops after `budgetMs`.
 * Never guesses addresses (no "info@" patterns): only what the site shows.
 */

export type FoundEmail = { email: string; kind: "role" | "named"; url: string };
export type EmailLookup = { status: "found" | "none" | "blocked" | "failed"; emails: FoundEmail[]; siteName: string | null; note: string };

type Fetcher = typeof safeFetch;

export async function findEmailsOnWebsite(website: string, opts: { budgetMs?: number; fetcher?: Fetcher } = {}): Promise<EmailLookup> {
  const site = normalizeWebsite(website);
  if (!site) return { status: "failed", emails: [], siteName: null, note: "Not a website address." };
  const fetcher = opts.fetcher ?? safeFetch;
  const deadline = Date.now() + (opts.budgetMs ?? 10_000);
  const ua = `${brand.name}Bot/0.1 (+${configuredSiteUrl() ?? brand.siteUrl}; finding public business contact details)`;
  const origin = new URL(site.website).origin;

  const robots = await fetcher(`${origin}/robots.txt`, { userAgent: ua, deadline, maxBytes: 64 * 1024, accept: "text/plain,*/*;q=0.1" });
  let rules: ReturnType<typeof parseRobots> = [];
  if (robots.ok) rules = parseRobots(robots.body, "LocentiBot");
  else if (!/^HTTP 4\d\d$/.test(robots.reason)) return { status: "failed", emails: [], siteName: null, note: `Couldn't reach the website (${robots.reason}).` };

  const found = new Map<string, FoundEmail>();
  let siteName: string | null = null;
  const visit = async (url: string) => {
    const path = new URL(url).pathname || "/";
    if (!robotsAllows(rules, path)) return null;
    const r = await fetcher(url, { userAgent: ua, deadline, allowTypes: /text\/html|application\/xhtml\+xml/i });
    if (!r.ok) return null;
    const page = extractPage(r.body, r.url);
    for (const e of businessEmails(page.emails, site.domain, page.mailto)) if (!found.has(e.email)) found.set(e.email, { ...e, url: r.url });
    return page;
  };

  if (!robotsAllows(rules, new URL(site.website).pathname || "/")) return { status: "blocked", emails: [], siteName: null, note: "The website's robots.txt asks tools not to read it." };
  const home = await visit(site.website);
  if (!home) return { status: "failed", emails: [], siteName: null, note: "Couldn't read the homepage." };
  siteName = home.siteName;
  // Contact, impressum, about/team, then privacy pages.
  // Sites whose menu is built by scripts link to nothing readable, so try the usual contact addresses.
  const linked = pickContactPages(home, 3);
  const homeOrigin = new URL(home.url).origin;
  const next = linked.length ? linked : [`${homeOrigin}/contact`, `${homeOrigin}/contact-us`];
  // Read them side by side (faster), unless the homepage already showed an address.
  if (!found.size && Date.now() < deadline - 1500) await Promise.all(next.map((url) => visit(url).catch(() => null)));
  const emails = [...found.values()].sort((a, b) => Number(a.kind === "named") - Number(b.kind === "named")).slice(0, 5);
  return emails.length
    ? { status: "found", emails, siteName, note: `Found on ${new URL(emails[0].url).pathname || "/"}` }
    : { status: "none", emails: [], siteName, note: linked.length ? "No email shown on the homepage or its contact/about pages." : "No email shown on the homepage, and it links to no contact page." };
}
