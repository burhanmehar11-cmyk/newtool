import { discoveryNiches } from "@/lib/discovery/niches";
import { CountUp } from "./count-up";

/** Product facts (not usage metrics) and an endless strip of the business types Locenti searches. */
const facts: { value: number; suffix: string; label: string; text?: string }[] = [
  { value: 20, suffix: "", label: "businesses per Google Maps search, with website, phone and rating" },
  { value: 3, suffix: "", label: "pages of each website read, with every fact linked to its source" },
  { value: 0, suffix: "", label: "emails sent without your review and approval" },
  { value: 1, suffix: "", text: "1-click", label: "unsubscribe in every email, honoured automatically" },
];

export function ProofBand() {
  const niches = [...discoveryNiches.map((n) => n.label), "Chiropractors", "Plumbers", "Restaurants", "Real estate agents", "Gyms", "Auto repair shops"];
  return (
    <section aria-label="What Locenti does" className="border-b border-line bg-surface">
      <div className="container-page grid gap-8 py-14 sm:grid-cols-2 lg:grid-cols-4" data-stagger="90">
        {facts.map((f) => (
          <div key={f.label} data-reveal>
            <p className="font-display text-5xl font-bold tracking-tight text-ink">
              {f.text ? f.text : <CountUp to={f.value} />}
              {f.suffix ? <span className="text-green">{f.suffix}</span> : null}
            </p>
            <p className="mt-2 max-w-[240px] text-sm leading-6 text-slate">{f.label}</p>
          </div>
        ))}
      </div>
      <div className="marquee overflow-hidden border-t border-line py-4">
        <ul className="marquee-track flex w-max gap-3" aria-label="Business types you can search">
          {[...niches, ...niches].map((n, i) => (
            <li key={`${n}-${i}`} aria-hidden={i >= niches.length || undefined} className="whitespace-nowrap rounded-full border border-line bg-canvas px-3.5 py-1.5 text-sm font-medium text-ink">
              {n}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
