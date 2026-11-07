import "server-only";
import { brand } from "@/config/brand";
import { businessEmails, contactPagesFromSitemap, extractPage, pickContactPages } from "@/lib/research/extract";
import { parseRobots, robotsAllows } from "@/lib/research/robots";
import { normalizeWebsite } from "@/lib/discovery/osm";
import { configuredSiteUrl } from "@/server/env";
import { safeFetch } from "@/server/research/fetch";

/**
 * Finds public email addresses a business shows on its own website. Reads the
 * homepage (trying the www/non-www and http variants if it doesn't answer);
 * if it shows none, reads up to eight likely pages side by side: contact,
 * impressum, about/team and privacy pages it links to or lists in its
 * sitemap, plus the usual /contact and /about addresses. Respects robots.txt,
 * uses the SSRF-safe fetcher, and stops after `budgetMs`. Never guesses
 * addresses (no "info@" patterns): only what the site shows.
 */

export type FoundEmail = { email: string; kind: "role" | "named"; url: string };
export type EmailLookup = { status: "found" | "none" | "blocked" | "failed"; emails: FoundEmail[]; siteName: string | null; note: string };

type Fetcher = typeof safeFetch;

const HTML = /text\/html|application\/xhtml\+xml/i;
// Pages can be large (site builders put everything in one file); the footer with the address is often near the end.
const PAGE_BYTES = 2 * 1024 * 1024;
const FALLBACK_PATHS = ["/contact", "/contact-us", "/about", "/about-us"];
const MAX_PAGES = 8;

/** The homepage addresses to try, in order: as given, with/without www, then plain http. */
function homeVariants(website: string): string[] {
  const u = new URL(website);
  const alt = new URL(website);
  alt.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
  const http = new URL(website);
  http.protocol = "http:";
  return [...new Set([u.toString(), alt.toString(), u.protocol === "https:" ? http.toString() : null].filter((x): x is string => !!x))];
}

export async function findEmailsOnWebsite(website: string, opts: { budgetMs?: number; fetcher?: Fetcher; businessName?: string | null } = {}): Promise<EmailLookup> {
  const site = normalizeWebsite(website);
  if (!site) return { status: "failed", emails: [], siteName: null, note: "Not a website address." };
  const fetcher = opts.fetcher ?? safeFetch;
  const deadline = Date.now() + (opts.budgetMs ?? 12_000);
  // Starts like a browser's, as crawlers' do, so site firewalls don't turn it away, and says who it is.
  const ua = `Mozilla/5.0 (compatible; ${brand.name}Bot/0.2; +${configuredSiteUrl() ?? brand.siteUrl}; finding public business contact details)`;

  const robotsByOrigin = new Map<string, Promise<ReturnType<typeof parseRobots> | "unreachable">>();
  const robotsFor = (origin: string) => {
    if (!robotsByOrigin.has(origin))
      robotsByOrigin.set(
        origin,
        fetcher(`${origin}/robots.txt`, { userAgent: ua, deadline, maxBytes: 64 * 1024, accept: "text/plain,*/*;q=0.1" }).then((r) =>
          r.ok ? parseRobots(r.body, "LocentiBot") : /^HTTP 4\d\d$/.test(r.reason) ? [] : "unreachable",
        ),
      );
    return robotsByOrigin.get(origin)!;
  };

  const found = new Map<string, FoundEmail>();
  let blocked = false;
  let unreachable = "";
  const visit = async (url: string, contactPage: boolean) => {
    const u = new URL(url);
    const rules = await robotsFor(u.origin);
    if (rules === "unreachable") return null;
    if (!robotsAllows(rules, u.pathname || "/")) {
      blocked = true;
      return null;
    }
    const r = await fetcher(url, { userAgent: ua, deadline, maxBytes: PAGE_BYTES, allowTypes: HTML });
    if (!r.ok) {
      unreachable = r.reason;
      return null;
    }
    const page = extractPage(r.body, r.url);
    for (const e of businessEmails(page.emails, site.domain, page.mailto, { businessName: opts.businessName, trustMailto: contactPage }))
      if (!found.has(e.email)) found.set(e.email, { ...e, url: r.url });
    return page;
  };

  let home: Awaited<ReturnType<typeof visit>> = null;
  for (const url of homeVariants(site.website)) {
    if (Date.now() > deadline - 1000) break;
    blocked = false;
    home = await visit(url, false).catch(() => null);
    if (home || blocked) break;
  }
  if (!home) {
    if (blocked) return { status: "blocked", emails: [], siteName: null, note: "The website's robots.txt asks tools not to read it." };
    return { status: "failed", emails: [], siteName: null, note: unreachable ? `Couldn't reach the website (${unreachable}).` : "Couldn't read the homepage." };
  }
  const siteName = home.siteName;
  const origin = new URL(home.url).origin;

  let linked: string[] = [];
  if (!found.size && Date.now() < deadline - 1500) {
    // Pages it links to, best first; then its sitemap; then the usual addresses.
    linked = pickContactPages(home, 5);
    let fromSitemap: string[] = [];
    if (linked.length < 3) {
      const rules = await robotsFor(origin);
      if (rules !== "unreachable" && robotsAllows(rules, "/sitemap.xml")) {
        const sm = await fetcher(`${origin}/sitemap.xml`, { userAgent: ua, deadline: Math.min(deadline, Date.now() + 3000), maxBytes: 512 * 1024, accept: "application/xml,text/xml;q=0.9,*/*;q=0.1" }).catch(() => null);
        if (sm?.ok) fromSitemap = contactPagesFromSitemap(sm.body, origin, 4);
      }
    }
    const seen = new Set([new URL(home.url).pathname.replace(/\/$/, "") || "/"]);
    const pages = [...linked, ...fromSitemap, ...FALLBACK_PATHS.map((p) => `${origin}${p}`)].filter((url) => {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (seen.has(path)) return false;
      seen.add(path);
      return true;
    });
    await Promise.all(pages.slice(0, MAX_PAGES).map((url) => visit(url, true).catch(() => null)));
  }

  const emails = [...found.values()].sort((a, b) => Number(a.kind === "named") - Number(b.kind === "named")).slice(0, 5);
  return emails.length
    ? { status: "found", emails, siteName, note: `Found on ${new URL(emails[0].url).pathname || "/"}` }
    : { status: "none", emails: [], siteName, note: linked.length ? "No email shown on the homepage or its contact/about pages." : "No email shown on the homepage or the usual contact pages." };
}
