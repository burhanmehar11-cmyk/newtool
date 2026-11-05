import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: "Does AI write the emails?",
    a: "Yes, two ways. The built-in AI writer drafts each first email from the lead's research and your pitch. Or connect your own AI agent (Claude, Cursor or any MCP client) and it can search, research and write inside your workspace using your own AI account. Either way, every email is based on facts with sources, and nothing is sent until you approve it.",
  },
  {
    q: "Where does lead data come from?",
    a: "Business listings come from Google Maps, through Google's official Places API (never scraping), or from OpenStreetMap's free open map data. Google results are shown live and not stored, as Google's terms require. Locenti then reads each business's public website (respecting robots.txt) for contact details and research. Every fact shows its source and the date it was collected.",
  },
  {
    q: "What does email verification mean?",
    a: "A verification provider checks whether an address is likely to accept mail. Results are valid, invalid, catch-all or unknown, each with the provider and time of the check. Verification reduces uncertainty. It does not guarantee delivery or that a person reads the email.",
  },
  {
    q: "Are messages reviewed before they're sent?",
    a: "Yes. You approve the exact campaign version: recipients, sequence and every draft. Editing approved content removes the approval until you review it again. Suggested replies stay drafts until you send them.",
  },
  {
    q: "Do I connect my own mailbox?",
    a: "Yes. Locenti works with Gmail, connected separately from your sign-in with send-only access: Locenti can send from your address but can't read your inbox. Each mailbox has its own daily limit.",
  },
  {
    q: "How is usage charged?",
    a: "Usage is counted in units: one per business returned by a search, one per address verified, one per brief or draft generated. You see the estimate before work starts and the actual use afterwards. Failed work is not charged, and retries never charge twice. Prices have not been set yet.",
  },
  {
    q: "How does an agency organise its work?",
    a: "Invite teammates as admins or members, and give each client its own workspace with its own leads, mailboxes, campaigns, usage and do-not-contact list, then switch between them from the sidebar. Admins connect mailboxes and approve campaigns; members find leads, research and write. A read-only viewer role is planned.",
  },
  {
    q: "Is this compliant with email law where I work?",
    a: "Outreach rules differ by country and by recipient type. The product will give you controls such as sender identity, a business address, visible opt-out and suppression. It can't make a campaign compliant on your behalf, so check the rules for your market.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-t border-line bg-surface py-20 sm:py-28">
      <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
        <div data-reveal>
          <p className="eyebrow text-green">FAQ</p>
          <h2 className="display-2 mt-4 text-ink">Straight answers.</h2>
          <p className="mt-5 text-[15px] leading-7 text-slate">
            How Locenti finds businesses, writes emails and keeps your outreach safe.
          </p>
        </div>
        <div className="divide-y divide-line border-y border-line" data-stagger="60">
          {faqs.map((f) => (
            <details key={f.q} data-reveal="fade" className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 text-left text-[17px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown aria-hidden className="size-5 shrink-0 text-slate transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="max-w-2xl pb-5 text-[15px] leading-7 text-slate">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="on-dark relative overflow-hidden bg-midnight py-20 text-white sm:py-28">
      <div aria-hidden data-parallax="0.25" className="pointer-events-none absolute -right-16 -top-10">
        <LogoMark className="size-[420px] text-white/[0.04]" />
      </div>
      <div className="container-page relative" data-stagger="100">
        <h2 data-reveal className="display-2 max-w-3xl text-white">Your next client starts with the right conversation.</h2>
        <p data-reveal className="mt-5 max-w-xl text-[17px] leading-8 text-white/72">
          Search Google Maps, find public emails, see what each website is missing, and send personal emails from your own Gmail.
        </p>
        <div data-reveal className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="mint" size="lg">
            <Link href="/sign-up">Get started</Link>
          </Button>
          <Button asChild variant="outline-dark" size="lg">
            <Link href="#how-it-works">See the workflow</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
