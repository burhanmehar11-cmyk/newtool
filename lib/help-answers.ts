/**
 * Instant answers for the help chat: common questions are answered straight
 * away from Locenti's own help content, with no AI call (and no waiting on
 * Google). Built on the server (so numbers like the trial length match the
 * deployment) and matched in the browser. The AI is used for everything else,
 * and as a fallback answer source when the AI is unavailable.
 */
import { trialDays } from "@/lib/admin";
import { faqs } from "@/lib/faq";
import { QUICK_PICKS } from "@/lib/help-content";

export type InstantAnswer = {
  id: string;
  text: string;
  /** Phrases that point to this answer (matched as whole words; longer phrases count more). */
  keys: string[];
  /** Questions answered with no matching at all (the suggested questions). */
  exact?: string[];
  link?: { href: string; label: string };
  topic: string;
  subject: string;
};

const faq = (q: string) => faqs.find((f) => f.q === q)?.a ?? "";
const pick = (id: string) => QUICK_PICKS.find((p) => p.id === id)!;
const steps = (id: string) => pick(id).answer.join(" ");

const CONTACT = "You can talk to our team any time: press “Talk to the team” here, or email hello@locenti.com. We usually reply within a day.";

const SHARED: InstantAnswer[] = [
  {
    id: "what-is",
    text: faq("What is Locenti?"),
    keys: ["what is locenti", "what does locenti do", "what locenti does", "how does locenti work", "about locenti", "what is this", "what do you do", "what does it do", "who is locenti for"],
    exact: ["What does Locenti do?"],
    topic: "other",
    subject: "Question about Locenti",
  },
  {
    id: "data-source",
    text: faq("Where does lead data come from?"),
    keys: ["where do the email come from", "where do email come from", "where does the data come from", "data come from", "lead data", "where do you get", "scrape", "scraping", "places api", "data source", "openstreetmap"],
    exact: ["Where do the emails come from?"],
    topic: "search",
    subject: "Question about lead data",
  },
  {
    id: "every-email",
    text: faq("Does every search result have an email?"),
    keys: ["every result", "all result", "have an email", "guessed", "guess email", "verified email", "real email", "fake email"],
    topic: "search",
    subject: "Question about emails in results",
  },
  {
    id: "ai-writes",
    text: faq("Does AI write the emails?"),
    keys: ["does ai write", "ai write", "write the email", "who write", "ai email", "chatgpt", "claude", "cursor", "mcp", "my own ai", "ai agent"],
    topic: "campaigns",
    subject: "Question about AI emails",
  },
  {
    id: "review",
    text: faq("Are messages reviewed before they're sent?"),
    keys: ["reviewed before", "review before", "approve", "approval", "sent automatically", "send automatically", "before sending", "before they are sent", "check before"],
    topic: "campaigns",
    subject: "Question about approving emails",
  },
  {
    id: "compliance",
    text: faq("Is this compliant with email law where I work?"),
    keys: ["gdpr", "can spam", "legal", "law", "compliant", "compliance", "spam law", "is it allowed"],
    topic: "other",
    subject: "Question about email rules",
  },
  {
    id: "trial-limit",
    text: "Trial workspaces can find 200 businesses a month (it resets on the 1st), and you're only charged for businesses returned with an email. Discover shows how many you have left.",
    keys: ["how many business", "how many lead", "trial limit", "monthly limit", "business a month", "lead a month", "200 business", "how many search", "search limit"],
    exact: ["How many businesses can I find on the trial?"],
    topic: "billing",
    subject: "Question about trial limits",
  },
  {
    id: "send-limits",
    text: "Each mailbox sends within its daily limit: 25 emails a day by default, up to 200 (change it on the Mailboxes page). Campaigns only send on the days and hours you choose, and stop following up with anyone who replies.",
    keys: ["daily limit", "email per day", "email a day", "sending limit", "send limit", "how many email can i send", "how many email", "emails per day"],
    topic: "mailbox",
    subject: "Question about sending limits",
  },
  {
    id: "contact",
    text: CONTACT,
    keys: ["talk to a human", "talk to human", "real person", "speak to someone", "talk to someone", "contact you", "contact support", "support email", "email you", "customer support", "your email address", "phone number"],
    topic: "other",
    subject: "I'd like to talk to the team",
  },
];

const SITE_ONLY: InstantAnswer[] = [
  {
    id: "price",
    text: `${faq("How much does it cost?")} Press “Start free trial” to try it.`,
    keys: ["price", "pricing", "cost", "how much", "plan", "paid", "subscription", "free trial", "trial", "credit card", "card", "free"],
    exact: ["How does the free trial work?"],
    topic: "billing",
    subject: "Question about pricing",
  },
  {
    id: "own-mailbox",
    text: faq("Do I connect my own mailbox?"),
    keys: ["own gmail", "my gmail", "own mailbox", "my own email", "send from my", "connect gmail", "gmail", "outlook", "which email provider", "mailbox"],
    exact: ["Does it send from my own Gmail?"],
    topic: "mailbox",
    subject: "Question about mailboxes",
  },
  {
    id: "agency",
    text: faq("How does an agency organise its work?"),
    keys: ["team", "teammate", "invite", "client access", "agency", "viewer", "colleague", "multiple user"],
    topic: "account",
    subject: "Question about teams",
  },
  {
    id: "get-started",
    text: `Press “Start free trial”, sign up with Google or your email (no card needed), then connect your mailbox (Gmail with an App Password, or any IMAP/SMTP mailbox), describe what you sell, and run your first search. The ${trialDays()}-day trial lets you try everything.`,
    keys: ["sign up", "signup", "get started", "create account", "create an account", "how do i start", "how to start", "register", "try it"],
    topic: "account",
    subject: "Question about signing up",
  },
];

const APP_ONLY: InstantAnswer[] = [
  {
    id: "connect-gmail",
    text: "Open Mailboxes → Add mailbox → Gmail / Google Workspace. In your Google account: turn on IMAP (Gmail settings), turn on 2-Step Verification, then create an App Password (myaccount.google.com/apppasswords). Paste the 16-character App Password, press Test connection, then Add mailbox. Zoho, Hostinger and other IMAP/SMTP mailboxes work the same way.",
    keys: ["connect gmail", "connect my gmail", "connect a mailbox", "connect mailbox", "add mailbox", "add a mailbox", "link gmail", "add gmail", "connect email", "connect my email"],
    exact: ["How do I connect my Gmail?"],
    link: { href: "/app/mailboxes", label: "Open Mailboxes" },
    topic: "mailbox",
    subject: "Help connecting my Gmail",
  },
  { id: "mailbox-reconnect", text: steps("mailbox-reconnect"), keys: ["app password", "reconnect", "reconnecting", "disconnected", "disconnecting", "keep disconnecting", "lost access", "mailbox error", "token expired"], link: pick("mailbox-reconnect").link, topic: "mailbox", subject: pick("mailbox-reconnect").subject },
  { id: "campaign-paused", text: steps("campaign-paused"), keys: ["campaign paused", "paused", "pause by itself", "stopped sending", "not sending", "won't send", "wont send", "resume"], exact: ["Why did my campaign pause?"], link: pick("campaign-paused").link, topic: "campaigns", subject: pick("campaign-paused").subject },
  { id: "few-emails", text: steps("few-emails"), keys: ["few result", "only a few", "not many result", "no result", "few business", "search found only", "too few", "more result", "more business", "not enough result"], link: pick("few-emails").link, topic: "search", subject: pick("few-emails").subject },
  { id: "better-emails", text: steps("better-emails"), keys: ["better email", "improve email", "improve my email", "write better", "email quality", "more personal", "better ai email"], exact: ["How do I write better emails?"], link: pick("better-emails").link, topic: "campaigns", subject: pick("better-emails").subject },
  { id: "invite-team", text: steps("invite-team"), keys: ["invite", "invite my team", "invite team", "add my team", "teammate", "add a user", "add user", "client access", "viewer", "team member", "colleague"], link: pick("invite-team").link, topic: "account", subject: pick("invite-team").subject },
  { id: "trial-plans", text: steps("trial-plans"), keys: ["price", "pricing", "cost", "how much", "plan", "paid", "subscription", "free trial", "trial", "billing", "upgrade"], link: pick("trial-plans").link, topic: "billing", subject: pick("trial-plans").subject },
  { id: "do-not-contact", text: steps("do-not-contact"), keys: ["unsubscribe", "do not contact", "suppression", "block domain", "block an email", "opt out", "optout", "bounce"], link: pick("do-not-contact").link, topic: "campaigns", subject: pick("do-not-contact").subject },
  {
    id: "replies",
    text: "Replies to your campaigns appear in Inbox (with reply tracking on), sorted into interested, not interested and out of office. Answer them from your Gmail. A reply stops follow-ups for that person.",
    keys: ["where do replies go", "replies", "reply tracking", "see replies", "inbox"],
    link: { href: "/app/inbox", label: "Open Inbox" },
    topic: "campaigns",
    subject: "Question about replies",
  },
  {
    id: "csv",
    text: "Open Leads and press “Import CSV” or “Export CSV”. An import needs a name and a website and/or email for each business (type and city are optional).",
    keys: ["csv", "import lead", "export lead", "import", "export", "spreadsheet", "excel", "download lead"],
    link: { href: "/app/leads", label: "Open Leads" },
    topic: "search",
    subject: "Question about CSV import/export",
  },
  {
    id: "follow-ups",
    text: "When you create a campaign you can add follow-up emails. They go out on the schedule you set, and stop automatically for anyone who replies or unsubscribes.",
    keys: ["follow up", "followup", "follow ups", "second email", "sequence"],
    link: { href: "/app/campaigns", label: "Open Campaigns" },
    topic: "campaigns",
    subject: "Question about follow-ups",
  },
  { id: "bug", text: steps("bug"), keys: ["broken", "bug", "crash", "error message", "page not loading", "not loading", "blank page"], topic: "bug", subject: pick("bug").subject },
];

/** The instant answers for the in-app chat or the website chat. */
export function instantAnswers(mode: "app" | "site"): InstantAnswer[] {
  return mode === "site" ? [...SHARED, ...SITE_ONLY] : [...APP_ONLY, ...SHARED];
}

/** Lowercase words, punctuation removed, simple plural folding ("emails" → "email"). */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/e-mail/g, "email")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ");
}

/**
 * Best instant answer for a question, or null. `strict` (before asking the
 * AI) needs a clear match on a short question; otherwise (when the AI is
 * unavailable) any match will do.
 */
export function matchAnswer(question: string, answers: InstantAnswer[], { strict = true } = {}): InstantAnswer | null {
  const q = normalize(question);
  if (!q) return null;
  const exact = answers.find((a) => a.exact?.some((e) => normalize(e) === q));
  if (exact) return exact;
  if (strict && q.split(" ").length > 18) return null;
  const padded = ` ${q} `;
  const scored = answers
    .map((a) => ({ a, score: [...new Set(a.keys.map(normalize))].reduce((n, k) => (k && padded.includes(` ${k} `) ? n + k.split(" ").length : n), 0) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
  const [best, second] = scored;
  if (!best) return null;
  if (!strict) return best.a;
  return best.score >= 2 && (!second || best.score > second.score) ? best.a : null;
}
