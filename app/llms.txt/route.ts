import { brand } from "@/config/brand";
import { faqs } from "@/lib/faq";
import { trialDays } from "@/lib/admin";
import { plans } from "@/config/plans";

/**
 * /llms.txt: a plain-text summary of Locenti for AI assistants and AI search
 * tools (the llms.txt convention), built from the same facts as the homepage.
 */
export function GET() {
  const site = brand.siteUrl;
  const text = `# ${brand.name}

> ${brand.name} is a prospecting and cold-email tool for agencies and freelancers who sell to local businesses. It finds businesses on Google Maps that show a public email, reads their websites, writes a personal first email for each with AI, and sends approved campaigns from the user's own Gmail.

Website: ${site}
Contact: ${brand.supportEmail}
Pricing: every plan (${plans.map((p) => p.name).join(", ")}) starts with a ${trialDays()}-day free trial, no card needed; prices to be announced.

## How it works

1. Search Google Maps by business type and city (through Google's official Places API; no scraping). Filters: must have an email, phone or website; minimum rating and reviews; open businesses only.
2. Locenti reads each business's own website and keeps only businesses that publicly show an email whose domain can receive mail. If an area runs out, it searches nearby smaller areas until it has the number asked for. Users are charged only for businesses returned with an email.
3. Save businesses as leads, research their websites (what they're missing, such as online booking or a mobile layout), import or export CSV.
4. Create a campaign: AI writes a personal first email for each lead from its website research and the user's offer. Optional follow-ups.
5. Review and approve: nothing is sent before approval. Emails go out from the user's Gmail within chosen days, hours and a daily limit.
6. Replies arrive in one inbox, sorted into interested, not interested and out of office. Bounces and opt-outs go on a do-not-contact list.

## Also

- Team workspaces with owner, admin, member and read-only viewer roles.
- Connect your own AI agent (Claude, Cursor or any MCP client) to search, research and draft; agents can't send or approve.
- REST API and signed webhooks.

## FAQ

${faqs.map((f) => `### ${f.q}\n\n${f.a}`).join("\n\n")}

## Pages

- [Home](${site}/)
- [Pricing](${site}/#pricing)
- [Privacy policy](${site}/legal/privacy)
- [Terms of service](${site}/legal/terms)
- [Acceptable use](${site}/legal/acceptable-use)
`;
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
