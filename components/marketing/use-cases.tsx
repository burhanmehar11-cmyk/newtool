import { Bot, MapPinned, MonitorSmartphone } from "lucide-react";

const cases = [
  {
    icon: MapPinned,
    offer: "Local SEO",
    who: "For agencies managing listings and reviews",
    evidence: ["Owner replied to 2 of the 20 most recent reviews", "Opening hours missing from the listing", "6 photos on the listing"],
    opener: "I was reading your recent reviews and saw replies on 2 of the latest 20…",
    caveat: "Review count and rating alone don't show how a business is doing. Use them as context, not proof.",
  },
  {
    icon: MonitorSmartphone,
    offer: "Website redesign",
    who: "For web designers and studios",
    evidence: ["Footer shows © 2018", "No mobile viewport tag on the homepage", "“Call to schedule”, no online booking found"],
    opener: "I noticed your homepage doesn't set a mobile viewport, so on phones it may show as a shrunken desktop page…",
    caveat: "An old copyright year is a weak signal. The brief says so, and you decide whether to use it.",
  },
  {
    icon: Bot,
    offer: "Automation services",
    who: "For teams selling AI and workflow automation",
    evidence: ["New-patient forms offered as printable PDFs", "Booking handled by phone", "No contact form on the site"],
    opener: "I noticed your new-patient forms are printable PDFs. That can mean a fair amount of re-typing for the front desk…",
    caveat: "Public pages can't show internal tools. Anything not observable is marked Unknown.",
  },
];

export function UseCases() {
  return (
    <section id="agencies" className="border-t border-line bg-surface py-20 sm:py-28">
      <div className="container-page">
        <div className="max-w-2xl" data-reveal>
          <p className="eyebrow text-green">For agencies</p>
          <h2 className="display-2 mt-4 text-ink">Different offers, different evidence.</h2>
          <p className="mt-5 text-[17px] leading-8 text-slate">
            The same clinic can be a strong lead for one service and a poor fit for another. Briefs are scored against the offer you sell.
          </p>
        </div>

        <div className="mt-12 divide-y divide-line border-y border-line">
          {cases.map(({ icon: Icon, offer, who, evidence, opener, caveat }) => (
            <article key={offer} data-reveal className="grid gap-6 py-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,4fr)_minmax(0,5fr)] lg:gap-10">
              <div>
                <span className="flex size-10 items-center justify-center rounded-xl bg-midnight text-mint">
                  <Icon aria-hidden className="size-[18px]" />
                </span>
                <h3 className="mt-4 text-xl font-bold text-ink">{offer}</h3>
                <p className="mt-1 text-sm text-slate">{who}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate">Evidence worth a conversation</p>
                <ul className="mt-3 space-y-2">
                  {evidence.map((e) => (
                    <li key={e} className="rounded-lg border border-line bg-canvas/60 px-3 py-2 text-sm text-ink">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate">Opening line it supports</p>
                <blockquote className="mt-3 border-l-2 border-green pl-4 text-[17px] leading-8 text-ink">{opener}</blockquote>
                <p className="mt-4 text-[13px] leading-6 text-slate">{caveat}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate">Examples use fictional sample businesses.</p>
      </div>
    </section>
  );
}
