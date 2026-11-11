/**
 * Help & Support content: Quick picks (common questions with an instant
 * answer and a ready request if it doesn't help) and the facts the AI help
 * assistant answers from. Keep it accurate: it's what people act on.
 */

export type QuickPick = {
  id: string;
  icon: "mail" | "pause" | "search" | "pen" | "users" | "card" | "ban" | "bug";
  title: string;
  /** Steps that usually solve it. */
  answer: string[];
  /** If it doesn't: the request it starts. */
  topic: "account" | "billing" | "search" | "mailbox" | "campaigns" | "bug" | "feature" | "other";
  subject: string;
  body: string;
  link?: { href: string; label: string };
};

export const QUICK_PICKS: QuickPick[] = [
  {
    id: "mailbox-reconnect",
    icon: "mail",
    title: "My mailbox says “needs reconnecting”",
    answer: [
      "Open Mailboxes and press Reconnect next to the address, then approve on Google's screen.",
      "Send yourself a test email from the Mailboxes page to make sure it works.",
      "Paused campaigns don't restart on their own: open each one and press Resume.",
    ],
    topic: "mailbox",
    subject: "My mailbox keeps asking to be reconnected",
    body: "Which mailbox: \nWhen it started: \nI already tried reconnecting: yes / no",
    link: { href: "/app/mailboxes", label: "Open Mailboxes" },
  },
  {
    id: "campaign-paused",
    icon: "pause",
    title: "A campaign paused by itself",
    answer: [
      "Locenti pauses a campaign when its mailbox loses access or Gmail's daily sending limit is reached, so nothing is lost.",
      "Check the bell for the reason. If the mailbox needs it, reconnect it on the Mailboxes page.",
      "Then open the campaign and press Resume. Emails continue within its sending hours.",
    ],
    topic: "campaigns",
    subject: "My campaign paused and won't resume",
    body: "Campaign name: \nWhat I see on the campaign page: ",
    link: { href: "/app/campaigns", label: "Open Campaigns" },
  },
  {
    id: "few-emails",
    icon: "search",
    title: "My search found only a few businesses",
    answer: [
      "Locenti only returns businesses that show a real email on their own website, so it keeps searching nearby areas until it has your number or runs out.",
      "Try a bigger area or a related business type (e.g. “marketing agency” and “digital agency”).",
      "Loosen filters such as minimum rating, reviews or “must have a phone”.",
      "Trial workspaces can find 200 businesses a month; Discover shows how many are left.",
    ],
    topic: "search",
    subject: "My searches return very few businesses",
    body: "Business type: \nCity / area: \nFilters I used: ",
    link: { href: "/app/discover", label: "Open Discover" },
  },
  {
    id: "better-emails",
    icon: "pen",
    title: "How do I get better AI emails?",
    answer: [
      "Settings → your offer: say clearly what you sell, who it's for and the result you deliver. Every email is written from it.",
      "Research a lead first: the AI uses what the business's website shows, so the email feels personal.",
      "Edit any draft before you approve; nothing is sent until you do.",
    ],
    topic: "campaigns",
    subject: "Help me improve my emails",
    body: "What I sell: \nWho I'm emailing: \nWhat I'd like to change in the emails: ",
    link: { href: "/app/settings", label: "Open Settings" },
  },
  {
    id: "invite-team",
    icon: "users",
    title: "Invite a teammate or a client",
    answer: [
      "Open Team and invite by email. Pick a role: admin (everything), member (find, research and write) or viewer (look only, good for clients).",
      "They get an email with a link; once they sign in they're in your workspace.",
    ],
    topic: "account",
    subject: "Question about inviting my team",
    body: "",
    link: { href: "/app/team", label: "Open Team" },
  },
  {
    id: "trial-plans",
    icon: "card",
    title: "My free trial and plans",
    answer: [
      "Every account starts with a free trial, no card needed.",
      "Paid plans (Starter, Growth and Agency) are coming soon; you'll be told before anything is charged.",
      "Billing shows your current plan.",
    ],
    topic: "billing",
    subject: "Question about my plan",
    body: "",
    link: { href: "/app/billing", label: "Open Billing" },
  },
  {
    id: "do-not-contact",
    icon: "ban",
    title: "Unsubscribes and do-not-contact",
    answer: [
      "Every campaign email has an unsubscribe link. People who unsubscribe, and addresses that bounce, are added to your do-not-contact list automatically.",
      "Add any address or whole domain yourself in Settings → Suppression (your do-not-contact list); Locenti never emails them.",
    ],
    topic: "campaigns",
    subject: "Question about unsubscribes",
    body: "",
    link: { href: "/app/settings", label: "Open Settings" },
  },
  {
    id: "bug",
    icon: "bug",
    title: "Something's broken",
    answer: ["Try refreshing the page, or signing out and in again.", "Still broken? Send us the details below; a screenshot helps a lot (reply to our confirmation email with it)."],
    topic: "bug",
    subject: "Something isn't working",
    body: "What I did: \nWhat I expected: \nWhat happened instead (any error message): \nPage: ",
  },
];

/** Facts for the AI help assistant, beyond the Quick picks. */
export const PRODUCT_FACTS = `
Locenti is a prospecting and cold-email tool for agencies and freelancers who sell to local businesses.
Main pages (sidebar): Dashboard (pipeline and setup checklist), Discover (search Google Maps by business type and city; only businesses showing a public email; filters: email, phone, website, minimum rating, minimum reviews, open only; keeps searching nearby areas until it has the number asked for; charged one unit per business returned with an email), Leads (saved businesses, website research, notes, CSV import and export, "Find missing emails"), Campaigns (pick leads, AI writes a personal first email per lead from its website research and your offer; optional follow-ups; review and approve, nothing sent before approval; pause, resume, edit, delete), Inbox (replies sorted into interested, not interested, out of office; reply from Gmail), Analytics (sent, reply rate per campaign), Mailboxes (connect Gmail, send a test, daily limit), Agent (connect your own AI app over MCP; it can't send), Team (invite admins, members, viewers), Billing (plan and trial), Settings (offer, signature, Suppression tab = do-not-contact list), Help & Support (this page).
The bell on the workspace card shows notifications. "Take the tour" on the Dashboard explains each page.
Sending: emails go from the user's own Gmail within the campaign's days and hours and the mailbox's daily limit (default 25, max 200). Replies stop follow-ups for that person. Every campaign email includes the sender's business address and an unsubscribe link.
Trial: free, no card; trial workspaces can find 200 businesses a month (resets on the 1st). Paid plans Starter, Growth and Agency are coming soon.
Contact: the team answers support requests, usually within a day; email hello@locenti.com.
`;
