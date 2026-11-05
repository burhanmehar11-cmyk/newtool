/**
 * Where a visitor came from, worked out once on their first page view from
 * utm tags or the referring site. Kept in session storage (no cookie) and
 * saved with the account only if they sign up. No personal data.
 */

export type Attribution = { source: string; medium: string | null; campaign: string | null; referrerHost: string | null; landingPath: string | null };

const KNOWN: [RegExp, string][] = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)yahoo\./, "yahoo"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/(^|\.)(twitter|x)\.com$|^t\.co$/, "x"],
  [/(^|\.)facebook\.com$|^fb\.me$|(^|\.)messenger\.com$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)producthunt\.com$/, "producthunt"],
  [/(^|\.)news\.ycombinator\.com$/, "hackernews"],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, "chatgpt"],
  [/(^|\.)claude\.ai$/, "claude"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
];

export const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct",
  google: "Google",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
  yahoo: "Yahoo",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  reddit: "Reddit",
  producthunt: "Product Hunt",
  hackernews: "Hacker News",
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  invite: "Team invite",
  unknown: "Unknown",
};

export const sourceLabel = (s: string) => SOURCE_LABELS[s] ?? s;

const clean = (v: string | null | undefined, max: number) => {
  const t = (v ?? "").trim().toLowerCase().replace(/[^a-z0-9._\-+ /]/g, "").slice(0, max);
  return t || null;
};

/** From a landing URL and document.referrer; ownHost referrals count as direct. */
export function attributionFrom(landing: string, referrer: string | null, ownHost: string): Attribution {
  let url: URL | null = null;
  try {
    url = new URL(landing);
  } catch {
    url = null;
  }
  let refHost: string | null = null;
  try {
    refHost = referrer ? new URL(referrer).hostname.toLowerCase().replace(/^www\./, "") : null;
  } catch {
    refHost = null;
  }
  if (refHost && (refHost === ownHost.replace(/^www\./, "") || refHost === "localhost")) refHost = null;
  const utm = (k: string) => url?.searchParams.get(k) ?? null;
  const utmSource = clean(utm("utm_source") ?? utm("ref"), 80);
  const source = utmSource ?? (refHost ? (KNOWN.find(([re]) => re.test(refHost!))?.[1] ?? refHost.slice(0, 80)) : "direct");
  return {
    source,
    medium: clean(utm("utm_medium"), 80) ?? (utmSource ? null : refHost ? (/google|bing|duckduckgo|yahoo/.test(source) ? "organic" : "referral") : null),
    campaign: clean(utm("utm_campaign"), 120),
    referrerHost: refHost,
    landingPath: url ? url.pathname.slice(0, 300) : null,
  };
}

/** Parses what the browser sent back at sign-up; anything malformed is dropped. */
export function parseAttribution(raw: unknown): Attribution | null {
  let v: unknown = raw;
  if (typeof raw === "string") {
    if (raw.length > 2000) return null;
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const str = (k: string, max: number) => (typeof o[k] === "string" ? clean(o[k] as string, max) : null);
  const source = str("source", 80);
  if (!source) return null;
  const path = typeof o.landingPath === "string" && o.landingPath.startsWith("/") ? o.landingPath.slice(0, 300) : null;
  return { source, medium: str("medium", 80), campaign: str("campaign", 120), referrerHost: str("referrerHost", 200), landingPath: path };
}

export const ATTRIBUTION_KEY = "locenti:src";
