import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { brand } from "@/config/brand";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: "Where does lead data come from?",
    a: "Today, business listings come from OpenStreetMap, free open map data, and Google Maps listings are being added through Google's official Places API rather than scraping. Locentio then reads each business's public website (respecting robots.txt) for contact details and research. Every fact shows its source and the date it was collected.",
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
    a: "Yes. The private beta starts with Gmail, connected separately from your sign-in with the narrowest access needed. Daily sending caps and business-hours schedules apply per mailbox. The demo has no mailbox and never sends anything.",
  },
  {
    q: "How is usage charged?",
    a: "Usage is counted in units: one per business returned by a search, one per address verified, one per brief or draft generated. You see the estimate before work starts and the actual use afterwards. Failed work is not charged, and retries never charge twice. Prices have not been set yet.",
  },
  {
    q: "How does an agency organise its work?",
    a: "Today: saved lists, tags, notes and a workspace-wide suppression list. Separate client workspaces with their own data, allowances and sending identities, plus owner, admin, operator and viewer roles, are planned for launch.",
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
            Answers describe the product as it stands today: an interactive demo, with the private beta in development.
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
          Walk through the whole workflow with sample data: search, research, draft, approve and review a reply. No account needed.
        </p>
        <div data-reveal className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="mint" size="lg">
            <Link href="/demo">Explore demo</Link>
          </Button>
          <Button asChild variant="outline-dark" size="lg">
            <Link href="#how-it-works">See the workflow</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-fog">{brand.name} is in private development. Sign-up opens with the private beta.</p>
      </div>
    </section>
  );
}
