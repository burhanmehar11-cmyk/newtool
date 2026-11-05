import type * as React from "react";
import Link from "next/link";
import { ArrowRight, MailCheck, MapPinned, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveDemo } from "./live-demo";

export function Hero() {
  return (
    <section className="on-dark relative overflow-hidden bg-midnight text-white">
      <div aria-hidden className="hero-aurora pointer-events-none absolute -inset-[10%]" />
      <div aria-hidden className="grid-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]" />

      <div className="container-page relative pb-12 pt-16 text-center sm:pt-20 lg:pt-24">
        <div className="mx-auto max-w-[980px]" data-stagger="90">
          <p data-reveal className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[12.5px] font-medium text-white/80">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-mint" />
            </span>
            New · Public emails found automatically for every Google Maps result
          </p>
          <h1 className="display-hero mt-6 text-white">
            <span data-reveal className="block">
              From a map search
            </span>
            <span data-reveal className="text-shine block">
              to booked conversations.
            </span>
          </h1>
          <p data-reveal className="mx-auto mt-6 max-w-[660px] text-lg leading-8 text-white/72">
            Find local businesses on Google Maps, see what their websites actually show, and let AI write a personal email for each one. You approve, and it sends from your own Gmail.
          </p>
          <div data-reveal className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="mint" size="lg">
              <Link href="/sign-up">
                Get started <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline-dark" size="lg">
              <Link href="#how-it-works">How it works</Link>
            </Button>
          </div>
          <ul data-reveal className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-white/60">
            <li className="inline-flex items-center gap-1.5">
              <MapPinned aria-hidden className="size-4 text-mint" /> Official Google Maps data
            </li>
            <li className="inline-flex items-center gap-1.5">
              <MailCheck aria-hidden className="size-4 text-mint" /> Sends from your Gmail
            </li>
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck aria-hidden className="size-4 text-mint" /> Nothing sends without approval
            </li>
          </ul>
        </div>
      </div>

      <div className="container-page relative pb-20 sm:pb-24">
        <div data-reveal="scale" style={{ "--reveal-delay": "380ms" } as React.CSSProperties} className="mx-auto max-w-[1120px]">
          <LiveDemo />
          <p className="mt-3 text-center text-xs text-fog">Product preview with fictional businesses and sample numbers. Hover to pause; click a step to jump.</p>
        </div>
      </div>
    </section>
  );
}
