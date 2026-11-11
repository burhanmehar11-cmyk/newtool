/**
 * Ready-written product emails for the admin's Announcements tab. Plain text
 * (lands in the Primary inbox more often than designed newsletters). Each
 * can be edited before sending. Placeholders: {{first_name}}, {{site}},
 * {{trial_days}}. The unsubscribe footer is added when sending.
 */

export type AnnouncementTemplate = { id: string; label: string; summary: string; subject: string; body: string };

export const ANNOUNCEMENT_TEMPLATES: AnnouncementTemplate[] = [
  {
    id: "new-home",
    label: "Locenti has a new home",
    summary: "The move to locenti.com, plus what's new: searches that keep going until they find emails, notifications and the tour.",
    subject: "Locenti has a new home (and finds a lot more emails)",
    body: `Hi {{first_name}},

Quick one: Locenti now lives at {{site}}. Your account is the same; just sign in there once.

While moving in, we shipped a few things you asked for:

1. Searches keep going until they find emails
Ask for 60 businesses and Locenti no longer stops at Google's first page. If an area runs out, it searches the nearby streets too, until it has 60 that show a real email. You're only charged for the ones with an email.

2. A smarter email finder
It now reads contact, about and team pages side by side, decodes hidden addresses, and recognises a business's other domains. Fewer "no email found", more people to talk to.

3. Notifications
The bell on your workspace card tells you when someone replies, when a campaign goes live or finishes, and when a mailbox needs attention.

4. A one-minute tour
New here, or showing a teammate around? Press "Take the tour" on your dashboard.

Try a search now: {{site}}/app/discover

Reply to this email if anything's missing. We read every reply.

Team Locenti`,
  },
  {
    id: "first-campaign",
    label: "Your first campaign in 10 minutes",
    summary: "A step-by-step nudge for people who signed up but haven't sent anything yet.",
    subject: "Your first Locenti campaign, in about 10 minutes",
    body: `Hi {{first_name}},

Most people who get replies with Locenti do the same five things. Here they are, in order:

1. Connect your Gmail (2 minutes)
Mailboxes → Connect Gmail, then send yourself a test email. Campaigns go out from your own address, so replies land in your own inbox.

2. Tell Locenti what you sell (2 minutes)
Settings → your offer, your tone and your signature. Every email is written from this, so a clear offer means better emails.

3. Find 20 businesses (1 minute)
Discover → a business type and a city, e.g. "dentists in Austin". You only get businesses that show a public email.

4. Start a campaign (3 minutes)
Select them and press "Start campaign". Locenti reads each website and writes a personal first email. Read them, edit anything you like.

5. Approve and relax
Nothing is sent until you approve. Emails go out within your sending hours, and replies are sorted for you in the Inbox.

Start here: {{site}}/app

Stuck on a step? Just reply; we'll help.

Team Locenti`,
  },
  {
    id: "reply-tips",
    label: "5 ways to get more replies",
    summary: "Practical cold-email advice for local businesses that also shows off Locenti's research.",
    subject: "5 small changes that get local businesses to reply",
    body: `Hi {{first_name}},

Local business owners are busy people who get a lot of email. A few habits make yours worth answering:

1. Open with something only they would recognise
"Your booking page doesn't work on phones" beats "I help businesses grow". Locenti's website research shows what each site is missing; use one finding in your first line.

2. Keep it short
A few sentences they can read between customers. One idea, one question.

3. Ask a small question
"Worth a 10-minute call next week?" is easier to say yes to than "Can I send a proposal?".

4. Send when they're at a desk
Mid-week mornings in their time zone tend to work for most local trades. Set your campaign's sending days and hours to match.

5. Follow up once
Plenty of replies come after a short, polite follow-up. Add one to your campaign; Locenti stops it automatically for anyone who replies.

Put it into practice: {{site}}/app/campaigns

Team Locenti`,
  },
  {
    id: "trial",
    label: "Your free trial",
    summary: "What's included in the trial and how to make the most of it.",
    subject: "Making the most of your {{trial_days}}-day Locenti trial",
    body: `Hi {{first_name}},

Your Locenti trial includes everything: Google Maps search with emails, website research, AI-written first emails, campaigns from your own Gmail, the reply inbox and team seats. No card needed.

Three things worth doing this week:

- Run two or three searches in different niches and see which one has the most businesses showing an email.
- Send one small campaign (10 to 20 businesses) to test your offer before going bigger.
- Invite a teammate or a client as a viewer from the Team page.

Your dashboard: {{site}}/app

If something doesn't work the way you expected, reply and tell us. That's how Locenti gets better.

Team Locenti`,
  },
];

export function findTemplate(id: string | null | undefined) {
  return ANNOUNCEMENT_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Fills in the placeholders. Unknown ones are left as they are, so a typo is visible in the test email. */
export function renderAnnouncement(text: string, vars: { first_name: string; site: string; trial_days: number }) {
  return text.replace(/\{\{\s*(first_name|site|trial_days)\s*\}\}/g, (_, k: keyof typeof vars) => String(vars[k]));
}

/** "sam.lee@agency.com" or a full name → "Sam"; falls back to "there". */
export function firstNameOf(name: string | null | undefined, email: string): string {
  const fromName = (name ?? "").trim().split(/\s+/)[0];
  const raw = fromName && !fromName.includes("@") ? fromName : email.split("@")[0].split(/[._+-]/)[0];
  // "burhanmehar11" is a username, not a name.
  if (/\d/.test(raw)) return "there";
  const clean = raw.replace(/[^\p{L}'-]/gu, "");
  return clean.length >= 2 && clean.length <= 30 ? clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase() : "there";
}
