import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { faqs } from "@/lib/faq";


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
            <Link href="/sign-up">Start free trial</Link>
          </Button>
          <Button asChild variant="outline-dark" size="lg">
            <Link href="#how-it-works">See the workflow</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
