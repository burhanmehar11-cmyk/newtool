"use client";

import * as React from "react";
import { Building2, CircleCheck, Globe, Lightbulb, Mail, MapPin, SlidersHorizontal, Star } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { EmailStatusBadge, FitBadge, SampleBadge } from "@/components/product/badges";
import { fixtureVerificationOutcome } from "@/demo/fixtures/businesses";
import { featured } from "./sample-data";

const AUTOPLAY_MS = 5200;

/**
 * Hero product canvas: a real, interactive miniature of the Discover screen.
 * Auto-advances the selection slowly until the visitor interacts. Autoplay is
 * off for reduced-motion users. Everything is fictional sample data.
 */
export function HeroCanvas() {
  const [index, setIndex] = React.useState(0);
  const [autoplay, setAutoplay] = React.useState(true);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (!autoplay || paused) return;
    // No autoplay for visitors who prefer reduced motion.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % 3), AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [autoplay, paused]);

  const sel = featured[index];
  const b = sel.business;
  const brief = sel.brief;
  const draftFact = brief.facts.find((f) => sel.draft.factIds.includes(f.id));
  const [lead, ...rest] = sel.draft.body.split("\n\n");
  const observation = rest[0] ?? "";

  return (
    <div
      className="relative overflow-hidden rounded-[18px] border border-white/10 bg-[#F6F7F3] text-ink shadow-dark"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Canvas top bar */}
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <span className="hidden text-slate sm:inline">Discover</span>
          <span className="hidden text-line-strong sm:inline">/</span>
          <span>Dental clinics in Austin, TX</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-slate sm:inline">10 results · 10 discovery units</span>
          <SampleBadge />
        </div>
      </div>

      <div className="grid lg:grid-cols-[208px_minmax(0,340px)_minmax(0,1fr)]">
        {/* Filters column */}
        <aside className="hidden border-r border-line bg-surface/70 p-4 lg:block" aria-label="Sample filters">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate">
            <SlidersHorizontal aria-hidden className="size-3.5" /> Filters
          </p>
          <dl className="space-y-3 text-[13px]">
            {[
              ["Business type", "Dental clinic"],
              ["Location", "Austin, TX"],
              ["Website", "Has a website"],
              ["Reviews", "30 or more"],
              ["Max results", "25"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate">{k}</dt>
                <dd className="mt-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[11px] leading-4 text-slate">Parsed from your request. Edit before running.</p>
        </aside>

        {/* Results list */}
        <div className="border-b border-line lg:border-b-0 lg:border-r" role="listbox" aria-label="Sample businesses">
          {featured.slice(0, 5).map((f, i) => {
            const active = i === index;
            const contact = f.business.contacts[0];
            const outcome = contact ? fixtureVerificationOutcome.get(contact.id) : undefined;
            return (
              <button
                key={f.business.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setIndex(i);
                  setAutoplay(false);
                }}
                className={cn(
                  "relative flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition-colors duration-200 last:border-b-0",
                  active ? "bg-surface" : "hover:bg-surface/60",
                  i > 2 && "hidden sm:flex",
                )}
              >
                <span
                  aria-hidden
                  className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full transition-colors duration-200", active ? "bg-green" : "bg-transparent")}
                />
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-green">
                  <Building2 aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{f.business.name}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-slate">
                    <span className="inline-flex items-center gap-0.5">
                      <Star aria-hidden className="size-3 fill-current text-warn-fg" /> {f.business.rating?.toFixed(1)}
                    </span>
                    <span>{f.business.reviewCount} reviews</span>
                    <span className="hidden truncate xl:inline">{f.business.distanceMi} mi</span>
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    <FitBadge level={f.brief.fit.level} />
                    {i < 3 && outcome ? <EmailStatusBadge status={outcome} /> : <EmailStatusBadge status="unverified" />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Brief + draft */}
        <div className="min-w-0 bg-surface p-4 sm:p-5">
          <div key={b.id} className="animate-fade-up">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-green">Opportunity Brief</p>
                <h3 className="mt-1 truncate font-display text-lg font-bold">{b.name}</h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate">
                  <span className="inline-flex items-center gap-1">
                    <MapPin aria-hidden className="size-3" /> {b.address}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Globe aria-hidden className="size-3" /> {b.domain}
                  </span>
                </p>
              </div>
              <FitBadge level={brief.fit.level} />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold text-ink">Observed · with sources</p>
                <ul className="space-y-1.5">
                  {brief.facts.slice(1, 5).map((f) => {
                    const linked = f.id === draftFact?.id;
                    const ev = b.evidence.find((e) => e.id === f.evidenceIds[0]);
                    return (
                      <li
                        key={f.id}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-[13px] leading-5 transition-colors duration-200",
                          linked ? "border-green/30 bg-mint-soft/70" : "border-line",
                        )}
                      >
                        <span className="flex gap-2">
                          <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-green" />
                          <span>{f.text}</span>
                        </span>
                        {ev ? <span className="mt-0.5 block pl-5 text-[11px] text-slate">{ev.label} · collected {formatDate(ev.collectedAt, { month: "short", day: "numeric" })}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Lightbulb aria-hidden className="size-3.5 text-info-fg" /> AI suggestion · inferred
                </p>
                <div className="rounded-lg border border-dashed border-info-fg/30 bg-info-bg/40 px-2.5 py-2 text-[13px] leading-5">
                  {brief.opportunities[0]?.text ?? "No clear opening for this offer."}
                </div>
                <p className="mt-3 text-xs text-slate">Unknown</p>
                <p className="mt-1 text-[12px] leading-5 text-slate">{brief.unknowns[brief.unknowns.length - 2]}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[12px] border border-line bg-canvas/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <Mail aria-hidden className="size-3.5 text-green" /> Draft · not sent
                </p>
                <span className="truncate text-[11px] text-slate">Subject: {sel.draft.subject}</span>
              </div>
              <p className="mt-2 text-[13px] leading-5 text-slate">{lead}</p>
              <p className="mt-1 line-clamp-3 text-[13px] leading-5">
                <mark className="rounded bg-mint-soft px-0.5 text-ink">{observation.split(". ")[0]}.</mark>{" "}
                <span className="text-slate">{observation.split(". ").slice(1).join(". ")}</span>
              </p>
              <p className="mt-2 text-[11px] text-green">Highlighted sentence is grounded in the highlighted fact.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
