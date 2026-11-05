/**
 * Reads public web pages and turns them into observable signals, each with a
 * short plain-text excerpt from the page as evidence. Page content is
 * untrusted data: it is never executed, never treated as instructions, and
 * only short excerpts are kept.
 */

export type PageSignals = {
  url: string;
  title: string | null;
  /** The name the site gives itself (og:site_name, else the first part of the title). */
  siteName: string | null;
  copyrightYear: { year: number; excerpt: string } | null;
  viewport: boolean;
  booking: { excerpt: string; via: string | null } | null; // online booking link/button seen
  phoneOnly: { excerpt: string } | null; // text asking people to call to book
  pdfForms: { excerpt: string } | null;
  contactForm: boolean;
  emails: string[];
  links: { href: string; text: string }[]; // same-site links, for picking pages to visit
};

const BOOKING_HOSTS: [RegExp, string][] = [
  [/calendly\.com/i, "Calendly"],
  [/zocdoc\.com/i, "Zocdoc"],
  [/acuityscheduling\.com|as\.me\//i, "Acuity Scheduling"],
  [/squareup\.com\/appointments|square\.site\/book/i, "Square Appointments"],
  [/setmore\.com/i, "Setmore"],
  [/vagaro\.com/i, "Vagaro"],
  [/mindbodyonline\.com|mindbody\.io/i, "Mindbody"],
  [/fresha\.com/i, "Fresha"],
  [/booksy\.com/i, "Booksy"],
  [/simplybook\.(me|it)/i, "SimplyBook.me"],
  [/localmed\.com/i, "LocalMed"],
  [/nexhealth\.com/i, "NexHealth"],
  [/janeapp\.com/i, "Jane"],
  [/housecallpro\.com/i, "Housecall Pro"],
  [/servicetitan\.com/i, "ServiceTitan"],
  [/clio\.com\/.*book|clio\.grow/i, "Clio"],
];

const BOOK_TEXT = /\b(book (an |your )?(appointment|online|now|a visit|a consultation)|schedule (an |your )?(appointment|online|now|a visit|a consultation)|request (an |your )?appointment|online booking|book online)\b/i;
const PHONE_ONLY = /\b(call (us )?(today )?(to|for|and) (schedule|book|make (an|your) appointment|set up (an|your) appointment)|please call (our office|us) to (schedule|book|complete)|appointments? (are )?(by|via) (phone|telephone) only)\b/i;
const EMAIL_RE = /[a-z0-9._%+-]{1,64}@[a-z0-9.-]+\.[a-z]{2,24}/gi;

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&copy;|&#169;|&#xa9;/gi, "©")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/** Visible text: scripts, styles, comments and tags removed; whitespace collapsed. */
export function visibleText(html: string) {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function snippet(text: string, index: number, len: number, pad = 70) {
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + len + pad);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? "") : null;
}

/** The business name a site gives itself: og:site_name, else the most name-like part of <title>. */
export function siteNameOf(html: string, title: string | null): string | null {
  const og = html.match(/<meta\b[^>]*property\s*=\s*["']og:site_name["'][^>]*>/i)?.[0];
  const ogName = og ? attr(og, "content")?.replace(/\s+/g, " ").trim() : null;
  const clean = (v: string | null | undefined) => (v && v.length >= 2 && v.length <= 80 && !/^(home|homepage|welcome)$/i.test(v) ? v : null);
  if (clean(ogName)) return ogName!;
  if (!title) return null;
  const parts = decodeEntities(title).split(/\s+[|–—·:-]\s+/).map((x) => x.trim()).filter((x) => clean(x));
  // "Home | Smile Dental" → "Smile Dental"; "Smile Dental | Dentist in Austin" → "Smile Dental"
  return parts[0] ?? null;
}

export function extractPage(html: string, pageUrl: string, now = new Date()): PageSignals {
  const base = new URL(pageUrl);
  const text = visibleText(html);
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim() || null;

  // Copyright year: the most recent plausible year next to © or "Copyright".
  let copyrightYear: PageSignals["copyrightYear"] = null;
  const thisYear = now.getUTCFullYear();
  for (const m of text.matchAll(/(?:©|\(c\)|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)) {
    const y = Number(m[1]);
    if (y >= 1995 && y <= thisYear && (!copyrightYear || y > copyrightYear.year)) copyrightYear = { year: y, excerpt: snippet(text, m.index ?? 0, m[0].length, 40) };
  }

  const viewport = /<meta[^>]+name\s*=\s*["']?viewport["']?[^>]*>/i.test(html);

  // Links (anchors), resolved to absolute URLs.
  const anchors: { href: string; text: string }[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(`<a ${m[1]}>`, "href");
    if (!href || href.startsWith("#")) continue;
    try {
      const u = new URL(href, base);
      anchors.push({ href: u.toString(), text: visibleText(m[2]).slice(0, 120) });
    } catch {
      /* ignore malformed links */
    }
  }

  let booking: PageSignals["booking"] = null;
  for (const a of anchors) {
    const platform = BOOKING_HOSTS.find(([re]) => re.test(a.href));
    if (platform || (BOOK_TEXT.test(a.text) && /^https?:/.test(a.href))) {
      booking = { excerpt: `Link “${a.text || a.href}” → ${a.href}`.slice(0, 240), via: platform?.[1] ?? null };
      break;
    }
  }
  if (!booking) {
    const m = text.match(BOOK_TEXT);
    // Text alone counts only when it points at doing it online.
    if (m && /online/i.test(m[0])) booking = { excerpt: snippet(text, m.index ?? 0, m[0].length), via: null };
  }

  const phoneMatch = text.match(PHONE_ONLY);
  const phoneOnly = phoneMatch ? { excerpt: snippet(text, phoneMatch.index ?? 0, phoneMatch[0].length) } : null;

  const pdf = anchors.find((a) => /\.pdf(\?|$)/i.test(a.href) && /(form|intake|registration|new[- ]patient|paperwork|questionnaire)/i.test(`${a.text} ${a.href}`));
  const pdfForms = pdf ? { excerpt: `Link “${pdf.text || "PDF"}” → ${pdf.href}`.slice(0, 240) } : null;

  const contactForm = /<form\b[\s\S]*?(type\s*=\s*["']?email|<textarea)[\s\S]*?<\/form>/i.test(html);

  const emails = new Set<string>();
  for (const a of anchors) if (a.href.toLowerCase().startsWith("mailto:")) emails.add(decodeURIComponent(a.href.slice(7).split("?")[0]).toLowerCase());
  for (const m of text.matchAll(EMAIL_RE)) emails.add(m[0].toLowerCase());

  const host = base.hostname.replace(/^www\./, "");
  const links = anchors.filter((a) => {
    try {
      const u = new URL(a.href);
      return /^https?:$/.test(u.protocol) && u.hostname.replace(/^www\./, "") === host;
    } catch {
      return false;
    }
  });

  return {
    url: pageUrl,
    title,
    siteName: siteNameOf(html, title),
    copyrightYear,
    viewport,
    booking,
    phoneOnly,
    pdfForms,
    contactForm,
    emails: [...emails].filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,24}$/i.test(e) && !/\.(png|jpe?g|gif|svg|webp)$/i.test(e)).slice(0, 10),
    links,
  };
}

const PAGE_PRIORITY: [RegExp, number][] = [
  [/book|appointment|schedul|reserve/i, 3],
  [/contact/i, 2],
  [/form|new[- ]?patient|intake|paperwork/i, 2],
];

/** Picks up to `max` same-site pages worth checking after the homepage. */
export function pickFollowUpPages(home: PageSignals, max = 2): string[] {
  const scored = new Map<string, number>();
  for (const l of home.links) {
    const u = new URL(l.href);
    u.hash = "";
    if (/\.(pdf|jpe?g|png|gif|zip|docx?)$/i.test(u.pathname) || u.pathname === new URL(home.url).pathname) continue;
    const score = PAGE_PRIORITY.reduce((s, [re, w]) => s + (re.test(`${l.text} ${u.pathname}`) ? w : 0), 0);
    if (score > 0) scored.set(u.toString(), Math.max(score, scored.get(u.toString()) ?? 0));
  }
  return [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([u]) => u);
}

const ROLE_LOCALS = /^(info|hello|contact|office|admin|frontdesk|front\.desk|reception|appointments?|booking|bookings|service|sales|support|team|enquiries|inquiries|mail|care|help|clinic)$/i;
const FREE_MAIL = /@(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|aol|proton|protonmail)\.[a-z.]+$/i;

/** Keeps emails that plausibly belong to this business: its own domain, or a common free mailbox. */
export function businessEmails(emails: string[], domain: string | null): { email: string; kind: "role" | "named" }[] {
  const d = (domain ?? "").toLowerCase();
  return [...new Set(emails)]
    .filter((e) => (d && (e.endsWith(`@${d}`) || e.endsWith(`.${d}`))) || FREE_MAIL.test(e))
    .slice(0, 5)
    .map((email) => ({ email, kind: ROLE_LOCALS.test(email.split("@")[0]) ? "role" : "named" }));
}
