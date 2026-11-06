"use client";

import * as React from "react";
import { SectionCard } from "@/components/app/page-header";
import { DiscoverForm } from "@/features/product/discover-form";
import { GoogleCredit, GoogleResults, GoogleSearchForm, type SearchPrefill } from "@/features/product/google-search";
import type { GoogleSearchOutcome } from "@/server/services/discovery";
import { cn } from "@/lib/utils";

type Done = Extract<GoogleSearchOutcome, { ok: true }> & { niche: string };

export function DiscoverPanel({
  available,
  google,
  recent,
  prefill,
}: {
  available: number;
  google: { configured: boolean; remainingToday?: number | null };
  recent: React.ReactNode;
  prefill?: SearchPrefill;
}) {
  const [source, setSource] = React.useState<"google" | "osm">(google.configured ? "google" : "osm");
  const [result, setResult] = React.useState<Done | null>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  // When a search finishes, bring its results into view.
  React.useEffect(() => {
    if (!result) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [result]);

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <SectionCard
          title="New search"
          actions={
            <div role="radiogroup" aria-label="Data source" className="inline-flex rounded-lg border border-line bg-canvas p-0.5 text-xs font-medium">
              {(
                [
                  ["google", "Google Maps"],
                  ["osm", "OpenStreetMap"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={source === id}
                  disabled={id === "google" && !google.configured}
                  title={id === "google" && !google.configured ? "Add GOOGLE_PLACES_API_KEY on the server to enable" : undefined}
                  onClick={() => setSource(id)}
                  className={cn("rounded-md px-2.5 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50", source === id ? "bg-surface text-ink shadow-sm" : "text-slate hover:text-ink")}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          {source === "google" ? (
            <GoogleSearchForm available={available} remainingToday={google.remainingToday ?? null} onResult={setResult} prefill={prefill} />
          ) : (
            <DiscoverForm available={available} />
          )}
          {!google.configured ? (
            <p className="mt-4 text-xs text-slate">Google Maps search isn&apos;t set up on this server yet (needs a Places API key). OpenStreetMap search is free and works now.</p>
          ) : null}
        </SectionCard>
        {recent}
      </div>

      {source === "google" && result ? (
        <div ref={resultsRef} className="scroll-mt-6">
        <SectionCard
          className="mt-5"
          title={result.query}
          description={`${result.results.length} with an email${result.withoutEmail?.length ? `, plus ${result.withoutEmail.length} without` : ""}, from ${result.requests} Google request${result.requests === 1 ? "" : "s"}. Save the ones you want; they aren't kept otherwise.`}
          bodyClassName="p-0"
        >
          <GoogleResults key={result.jobId} result={result} />
          <div className="border-t border-line px-5 py-3">
            <GoogleCredit />
          </div>
        </SectionCard>
        </div>
      ) : null}
    </>
  );
}
