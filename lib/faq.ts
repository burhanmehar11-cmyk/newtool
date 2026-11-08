/**
 * Homepage FAQ. Shown on the page and given to search engines as structured
 * data (FAQPage), so it must stay accurate: AI search tools quote it.
 */
import { trialDays } from "@/lib/admin";

export const faqs: { q: string; a: string }[] = [
  {
    q: "What is Locenti?",
    a: "Locenti is a prospecting and cold-email tool for agencies and freelancers who sell to local businesses. Search Google Maps by business type and city, get only businesses that show a public email, see what their websites are missing, let AI write a personal first email for each, and send approved campaigns from your own Gmail. Replies come back to one inbox.",
  },
  {
    q: "Where does lead data come from?",
    a: "Business listings come from Google Maps through Google's official Places API (never scraping), or from OpenStreetMap's free map data. Google results are shown live and not stored, as Google's terms require. Locenti then reads each business's own public website (respecting robots.txt) for contact emails and research, and shows where every fact came from.",
  },
  {
    q: "Does every search result have an email?",
    a: "Yes, by default. Locenti reads each business's website (homepage, contact, about and similar pages) and keeps only businesses that publicly show an email whose domain can receive mail. If one search area runs out, it keeps searching nearby smaller areas until it reaches the number you asked for. You're only charged for businesses returned with an email. Emails are never guessed.",
  },
  {
    q: "Does AI write the emails?",
    a: "Yes, two ways. The built-in AI writer drafts each first email from the business's website research and your offer. Or connect your own AI agent (Claude, Cursor or any MCP client) to search, research and write inside your workspace. Either way, nothing is sent until you review and approve it.",
  },
  {
    q: "Are messages reviewed before they're sent?",
    a: "Yes. You approve the exact campaign: recipients, messages and follow-ups. Campaigns send within your chosen days and hours and each mailbox's daily limit, and you can pause, resume, edit or stop them at any time.",
  },
  {
    q: "Do I connect my own mailbox?",
    a: "Yes. Connect a Gmail address and Locenti sends from it. By default it only gets permission to send. If you turn on reply tracking, it also reads the replies to your campaigns so they appear in Locenti's inbox, sorted into interested, not interested and out of office.",
  },
  {
    q: "How much does it cost?",
    a: `Every plan starts with a ${trialDays()}-day free trial, no card needed. Prices for the Starter, Growth and Agency plans will be announced soon. Usage is counted per business found with an email; failed work is never charged.`,
  },
  {
    q: "How does an agency organise its work?",
    a: "Everyone works in one shared workspace: invite teammates as admins or members, and clients as read-only viewers. Admins connect mailboxes and approve campaigns; members find leads, research and write; viewers can look but not change anything. Notes, CSV import and export, and a do-not-contact list keep the work organised.",
  },
  {
    q: "Is this compliant with email law where I work?",
    a: "Outreach rules differ by country and recipient type. Locenti gives you the controls: your sender identity, your business address in every email, a visible unsubscribe link, and a do-not-contact list that bounces and opt-outs are added to automatically. It can't make a campaign compliant on your behalf, so check the rules for your market.",
  },
];
