import Link from "next/link";
import { Check } from "lucide-react";
import { plans } from "@/config/plans";
import { PRICING_LIVE } from "@/config/milestone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pricing() {
  return (
    <section id="pricing" className="bg-canvas py-20 sm:py-28">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <p className="eyebrow text-green">Pricing</p>
          <h2 className="display-2 mt-4 text-ink">Private beta pricing coming soon.</h2>
          <p className="mt-5 text-[17px] leading-8 text-slate">
            Plans will be based on discovery, verification and AI usage, so you pay for the work done. The groupings below are illustrative while we finalise them.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3" data-stagger="110">
          {plans.map((p) => (
            <div
              key={p.id}
              data-reveal
              className={cn(
                "flex flex-col rounded-[16px] border p-6",
                p.highlight ? "on-dark border-midnight bg-midnight text-white shadow-float" : "border-line bg-surface shadow-card",
              )}
            >
              <h3 className={cn("text-xl font-bold", p.highlight ? "text-white" : "text-ink")}>{p.name}</h3>
              <p className={cn("mt-2 min-h-12 text-sm leading-6", p.highlight ? "text-fog" : "text-slate")}>{p.summary}</p>
              <div className={cn("mt-5 rounded-[10px] px-3 py-3", p.highlight ? "bg-white/[0.06]" : "bg-canvas")}>
                {PRICING_LIVE && p.monthlyPriceUsd !== null ? (
                  <p className="font-display text-3xl font-bold">${p.monthlyPriceUsd}/mo</p>
                ) : (
                  <p className={cn("text-sm font-medium", p.highlight ? "text-white" : "text-ink")}>Price to be announced</p>
                )}
              </div>
              <div className="mt-6 flex-1 space-y-5">
                {p.groups.map((g) => (
                  <div key={g.title}>
                    <p className={cn("text-xs font-semibold uppercase tracking-[0.08em]", p.highlight ? "text-fog" : "text-slate")}>{g.title}</p>
                    <ul className="mt-2.5 space-y-2">
                      {g.items.map((it) => (
                        <li key={it} className="flex gap-2.5 text-sm leading-6">
                          <Check aria-hidden className={cn("mt-1 size-4 shrink-0", p.highlight ? "text-mint" : "text-green")} />
                          <span className={p.highlight ? "text-white/90" : "text-ink"}>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <Button asChild variant={p.highlight ? "mint" : "secondary"} className="mt-8 w-full">
                <Link href="/demo">Explore demo</Link>
              </Button>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-5 text-slate">
          No prices, limits, trial terms or discounts have been set. Nothing on this page is an offer.
        </p>
      </div>
    </section>
  );
}
