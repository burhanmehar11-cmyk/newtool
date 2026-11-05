import { brand } from "@/config/brand";

/**
 * Published legal pages. Owner, contact and address come from brand config
 * (NEXT_PUBLIC_LEGAL_NAME, NEXT_PUBLIC_CONTACT_EMAIL, NEXT_PUBLIC_BUSINESS_ADDRESS,
 * NEXT_PUBLIC_LEGAL_COUNTRY). Keep the Google user data section in step with
 * the scopes the app requests (lib/auth/oidc.ts, lib/gmail/oauth.ts).
 */

export const LEGAL_UPDATED = "November 5, 2026";

type Doc = { title: string; intro: string; sections: { h: string; p: string[] }[] };

const name = brand.name;
const owner = brand.legalEntity ?? name;
const email = brand.supportEmail;
const where = [brand.businessAddress, brand.legalCountry].filter(Boolean).join(", ");
const contact = `${owner}${brand.ownerRole ? ` (${brand.ownerRole})` : ""}${where ? `, ${where}` : ""}. Email: ${email}.`;

export const legalDocs: Record<string, Doc> = {
  privacy: {
    title: "Privacy policy",
    intro: `This policy explains what information ${name} collects, why, how it is used and shared, how long it is kept, and the choices you have. It applies to the ${name} website and web app (the "Service").`,
    sections: [
      {
        h: "1. Who we are",
        p: [`${name} is operated by ${contact} We are the controller of the personal information described here. For anything about privacy, write to ${email}.`],
      },
      {
        h: "2. Summary",
        p: [
          `${name} helps agencies and consultants find local businesses, research their public websites and send personal emails from their own Gmail account after reviewing and approving each message.`,
          "We collect only what the Service needs to work. We do not sell personal information, we do not use it for advertising, and we do not use Google user data to train AI models.",
        ],
      },
      {
        h: "3. Information we collect",
        p: [
          "Account information: your name, email address and Google account identifier when you sign in with Google, or your email address and a securely hashed password if you sign up with email. We also keep the date of your last sign-in and records of active sessions so you can be signed out remotely.",
          "Workspace content: the offer profile you write (service, value proposition, sender name, business address, booking link), leads you save, notes, research results, email drafts, campaigns, approval records, your do-not-contact list, and access tokens you create for AI agents (stored only as a hash).",
          "Business information: when you search, we receive business listings from the Google Places API (Google Maps) or OpenStreetMap. Google Maps results are shown to you live and are not stored, except the Google place ID of businesses you save. When you research a lead, we read up to a few public pages of that business's own website (respecting its robots.txt) and keep short excerpts as sources, plus any business email address the website publicly shows.",
          "Mailbox information: if you connect a Gmail account, see section 4.",
          "Technical information: IP address and browser information in server logs, used for security, abuse prevention and rate limits; and the cookies described in section 7.",
        ],
      },
      {
        h: "4. Google user data",
        p: [
          `${name} uses Google APIs only for the features you choose. Here is exactly what we request and why:`,
          "Sign in with Google (openid, email, profile): your Google account identifier, email address, name and profile picture URL, used only to create your account and sign you in.",
          "Gmail sending (gmail.send), when you click Connect Gmail: lets the Service send emails from your Gmail address. It is used only to send emails you reviewed and approved in a campaign, or a test email to yourself. This permission cannot read your mailbox.",
          "Reply tracking (gmail.readonly), only if you turn it on for a mailbox: used only to read the email conversations that the Service started, so it can show you replies, label them (for example interested or out of office), and stop emailing people who decline, unsubscribe or whose address bounces. We do not read, store or use any other email in your mailbox. Reply text is stored as plain text in your workspace so you can see it in the Inbox.",
          "Storage and security: the long-lived Google access grant (refresh token) for a connected mailbox is encrypted (AES-256-GCM) before it is stored, and short-lived access tokens are kept only in server memory. Only you and members of your workspace can see your workspace's emails and replies.",
          "Use: Google user data is used only to provide the features above that you can see in the Service. It is not used for advertising, not sold, not used to build user profiles for other purposes, not used to train or improve any AI or machine-learning model, and not sent to any AI service, including the optional built-in AI writer.",
          "Sharing: we do not transfer Google user data to anyone except our hosting and database providers (section 6) as needed to run the Service, when you direct us to, for security purposes, or to comply with the law.",
          "Human access: no person at " + name + " reads your email content unless you ask us to for support, it is necessary for security or to investigate abuse, or it is required by law.",
          `Limited Use: ${name}'s use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy (https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.`,
          "Your control: disconnect a mailbox at any time on the Mailboxes page. Disconnecting revokes the grant at Google and deletes the stored token. You can also remove access at https://myaccount.google.com/permissions.",
        ],
      },
      {
        h: "5. How we use information",
        p: [
          "To provide the Service: sign-in, searches, website research, finding public business emails, drafting emails, sending approved campaigns within your limits and sending hours, and showing replies.",
          "To keep the Service safe: preventing abuse, enforcing usage limits, honouring opt-outs, and investigating security issues.",
          "To communicate with you: account emails such as sign-up confirmation and password resets. We do not send marketing email without your consent.",
          "Optional AI writing: if you use the built-in AI writer, the lead's research summary (facts found on the business's public website) and your offer profile are sent to Google's Gemini API to draft an email. No Gmail data is included. If you connect your own AI agent, the data your agent requests is shared with your agent's provider under your own agreement with them.",
        ],
      },
      {
        h: "6. Who we share information with",
        p: [
          "Service providers that process data for us to run the Service: Vercel (hosting), Neon (database), Google (sign-in, Gmail API, Google Maps Places API and, if enabled, the Gemini API), OpenStreetMap services (the search area and business type you enter), and our email delivery provider for account emails.",
          "Business websites you research receive a normal web request from our server, identified as a bot.",
          "We may disclose information if required by law, to protect rights and safety, or as part of a merger or acquisition, in which case this policy continues to apply to it.",
          "We do not sell or rent personal information.",
        ],
      },
      {
        h: "7. Cookies and local storage",
        p: [
          "We use only essential cookies: a signed session cookie to keep you signed in, a short-lived cookie that protects the Google sign-in and Gmail connection steps, and a cookie that remembers your active workspace. Your light or dark appearance choice is kept in your browser's local storage.",
          "We do not use advertising cookies or third-party tracking, and campaign emails contain no tracking pixels.",
        ],
      },
      {
        h: "8. People and businesses you contact",
        p: [
          "Email addresses of businesses come only from public sources: the business's own website or its public listing. We never guess addresses.",
          "Every campaign email includes the sender's business address and an unsubscribe link. Anyone who unsubscribes, asks to stop, or whose address bounces is added to the sender's do-not-contact list and is not emailed again from that workspace. Recipients can also contact us at " + email + " to object to processing.",
        ],
      },
      {
        h: "9. How long we keep information",
        p: [
          "Account and workspace data: while your account is active. When you ask us to delete your account, we delete it, including workspace content and stored tokens, within 30 days, except where we must keep limited records by law.",
          "Mailbox access: deleted immediately when you disconnect a mailbox.",
          "Google Maps content: not stored, except place IDs of saved businesses, which Google allows.",
          "Do-not-contact entries: kept so opt-outs keep being honoured, even after the related lead is deleted.",
          "Server logs: kept by our hosting provider for a limited period for security and troubleshooting.",
        ],
      },
      {
        h: "10. Security",
        p: [
          "We use encrypted connections (HTTPS), encryption of stored mailbox tokens, hashed passwords and access tokens, row-level access controls so each workspace only sees its own data, and least-privilege access permissions. No system is perfectly secure; if we become aware of a breach affecting your information, we will notify you as required by law.",
        ],
      },
      {
        h: "11. Your rights and choices",
        p: [
          `You can access, correct, export or delete your information, and object to or restrict certain processing. Many changes can be made in the app; for anything else write to ${email}. We respond within 30 days.`,
          "If you are in the European Economic Area or the United Kingdom, our legal bases are: performance of our contract with you (providing the Service), legitimate interests (security, preventing abuse, and enabling business-to-business outreach with opt-outs), consent (where we ask for it, such as connecting Gmail), and legal obligations. You may complain to your local data protection authority.",
          "If you are a California resident, you have the right to know, delete and correct personal information and not to be discriminated against for exercising these rights. We do not sell or share personal information for cross-context behavioral advertising.",
        ],
      },
      {
        h: "12. Children",
        p: [`${name} is a business tool and is not intended for anyone under 16. We do not knowingly collect information from children.`],
      },
      {
        h: "13. International transfers",
        p: ["Our providers may process information in countries other than yours. Where required, transfers rely on appropriate safeguards such as standard contractual clauses."],
      },
      {
        h: "14. Changes to this policy",
        p: ["We will update this page when our practices change and change the date at the top. If changes are significant, we will tell you in the app or by email before they take effect."],
      },
      {
        h: "15. Contact",
        p: [`Questions or requests about privacy: ${contact}`],
      },
    ],
  },
  terms: {
    title: "Terms of service",
    intro: `These terms are an agreement between you and ${owner} about your use of ${name}. By creating an account or using the Service, you agree to them.`,
    sections: [
      { h: "1. Who we are", p: [`${name} is operated by ${contact}`] },
      {
        h: "2. The Service",
        p: [
          `${name} helps you find local businesses, research their public websites, find their public business email addresses, write personal emails (yourself, with the built-in AI writer, or with your own AI agent), and send them from a Gmail account you connect, after you review and approve them.`,
          "Features may change as we improve the Service. Access may currently be by invitation.",
        ],
      },
      {
        h: "3. Your account",
        p: [
          "You must give accurate information, keep your sign-in and access tokens secure, and be at least 16 and able to enter into a contract. You are responsible for activity in your account and workspaces, including actions taken by AI agents you connect with your tokens.",
        ],
      },
      {
        h: "4. Your outreach and content",
        p: [
          "You are responsible for the emails you send and for complying with the laws that apply to you and your recipients, including anti-spam and privacy laws such as CAN-SPAM, GDPR, PECR and CASL. Identify yourself accurately, include a valid business address, honour opt-outs promptly, and only contact businesses where you have a legitimate reason.",
          "You keep ownership of your content. You give us permission to process it only to provide the Service.",
          "Follow our Acceptable use policy.",
        ],
      },
      {
        h: "5. Third-party services",
        p: [
          "The Service uses third-party services, including Google Maps, Gmail and, if enabled, Google's Gemini API. Your use of Google Maps features is also subject to the Google Maps/Google Earth Additional Terms of Service (https://maps.google.com/help/terms_maps/) and the Google Privacy Policy (https://policies.google.com/privacy). Business listings and website content belong to their owners.",
        ],
      },
      {
        h: "6. AI-generated content",
        p: ["AI-written drafts are suggestions. Review every message before you approve it; you are responsible for what you send."],
      },
      {
        h: "7. Fees",
        p: ["If paid plans are introduced, prices and terms will be shown before you are charged, and you will choose whether to subscribe. We will not charge you without your agreement."],
      },
      {
        h: "8. Suspension and termination",
        p: ["You can stop using the Service and ask us to delete your account at any time. We may suspend or end access if you break these terms or the Acceptable use policy, put others at risk, or if required by law, and will tell you why where we can."],
      },
      {
        h: "9. Disclaimers",
        p: ["The Service is provided \"as is\". Business data comes from third parties and public websites and may be incomplete or out of date. We do not guarantee email delivery, replies or business results."],
      },
      {
        h: "10. Limitation of liability",
        p: ["To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability for any claim is limited to the amount you paid us for the Service in the 12 months before the claim. Nothing in these terms limits liability that cannot be limited by law."],
      },
      {
        h: "11. Changes",
        p: ["We may update these terms. We will change the date at the top and, for significant changes, tell you in advance in the app or by email. Continuing to use the Service after changes take effect means you accept them."],
      },
      {
        h: "12. Governing law",
        p: [`These terms are governed by the laws of ${brand.legalCountry ?? "the country where the operator is based"}, without affecting any mandatory consumer protections where you live.`],
      },
      { h: "13. Contact", p: [`${contact}`] },
    ],
  },
  "acceptable-use": {
    title: "Acceptable use policy",
    intro: `${name} is for honest, relevant business-to-business outreach. This policy is part of our Terms of service.`,
    sections: [
      {
        h: "Do",
        p: ["Contact businesses that publish their contact details and plausibly need what you offer.", "Identify yourself and your business truthfully, include your business address, and stop contacting anyone who asks you to."],
      },
      {
        h: "Don't",
        p: [
          "Send misleading sender names or subject lines, or impersonate anyone.",
          "Contact people who opted out, or use purchased, scraped or guessed personal email lists.",
          "Send harassment, threats, hateful, sexual, deceptive or illegal content, or content that promotes scams or malware.",
          "Try to bypass sending limits, the do-not-contact list, rate limits or Google's terms, or scrape Google Maps.",
          "Use the Service to collect data for resale or to build directories.",
        ],
      },
      {
        h: "Enforcement",
        p: [`We may pause campaigns, disconnect mailboxes, or suspend accounts that break this policy. To report abuse, email ${email}.`],
      },
    ],
  },
};
