import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroCanvas } from "./hero-canvas";
import { heroQuery } from "./sample-data";

export function Hero() {
  return (
    <section className="on-dark relative overflow-hidden bg-midnight text-white">
      <div aria-hidden className="grid-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-mint/[0.07] blur-3xl"
      />
      <div className="container-page relative pb-10 pt-16 sm:pt-20 lg:pt-24">
        <div className="max-w-[1040px]">
          <p className="eyebrow text-mint">Local prospecting, with context</p>
          <h1 className="display-hero mt-5 text-white">
            Find local prospects.
            <br />
            <span className="text-mint">Give them a reason to reply.</span>
          </h1>
          <p className="mt-6 max-w-[640px] text-lg leading-8 text-white/72">
            Discover businesses that fit your offer, understand the opportunity, and turn real research into personal outreach, all in one workspace.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild variant="mint" size="lg">
              <Link href="/demo">
                Explore demo <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline-dark" size="lg">
              <Link href="#how-it-works">See the workflow</Link>
            </Button>
          </div>
        </div>

        <form action="/demo/discover" method="get" className="mt-10 max-w-[720px]" role="search" aria-label="Try a search in the demo">
          <label htmlFor="hero-q" className="text-[13px] font-medium text-white/70">
            Describe who you want to reach
          </label>
          <div className="mt-2 flex flex-col gap-2 rounded-[14px] border border-white/12 bg-white/[0.04] p-2 backdrop-blur-sm transition-colors duration-200 focus-within:border-mint/60 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2">
              <Search aria-hidden className="size-4 shrink-0 text-mint" />
              <input
                id="hero-q"
                name="q"
                defaultValue={heroQuery}
                className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 focus:outline-none"
                autoComplete="off"
              />
            </div>
            <Button type="submit" variant="mint" className="h-10 shrink-0">
              Try it in the demo
            </Button>
          </div>
          <p className="mt-2 text-xs text-fog">Runs against fictional sample data. Nothing is searched, sent or charged.</p>
        </form>
      </div>

      <div className="container-page relative pb-20 sm:pb-24">
        <HeroCanvas />
      </div>
    </section>
  );
}
