"use client";

import * as React from "react";
import { CircleCheck, CircleDashed, CircleHelp, CircleMinus, Eye, Lightbulb } from "lucide-react";
import type { Business, OpportunityBrief } from "@/lib/domain/types";
import { cn, formatDate } from "@/lib/utils";
import { AiSuggestionBadge, ConfidenceBadge, FitBadge } from "./badges";
import { EvidenceItem } from "./evidence";

/**
 * The Opportunity Brief: observed facts (with sources) are visually separated
 * from inferred opportunities (AI suggestions). Missing data is shown as
 * Unknown and never counts toward fit.
 */
export function OpportunityBriefView({
  brief,
  business,
  stale,
  onEvidenceOpen,
  showRubric = true,
  live,
}: {
  brief: OpportunityBrief;
  business: Business;
  stale?: boolean;
  onEvidenceOpen?: () => void;
  showRubric?: boolean;
  /** Evidence comes from real pages (links open them). */
  live?: boolean;
}) {
  const evidenceById = new Map(business.evidence.map((e) => [e.id, e]));
  const [focusFact, setFocusFact] = React.useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <FitBadge level={brief.fit.level} stale={stale} />
        <ConfidenceBadge level={brief.confidence.level} />
        <span className="text-xs text-slate">Generated {formatDate(brief.generatedAt)} · {brief.generator === "demo-template" ? "demo template, no AI call" : brief.generator === "template" ? "rule-based, no AI call" : "AI"}</span>
      </div>

      <section aria-labelledby={`${brief.id}-facts`}>
        <h4 id={`${brief.id}-facts`} className="mb-2 flex items-center gap-2 font-sans text-[13px] font-semibold text-ink">
          <Eye aria-hidden className="size-4 text-green" /> Observed facts
          <span className="font-normal text-slate">from collected sources</span>
        </h4>
        {brief.facts.length ? (
          <ul className="space-y-1.5">
            {brief.facts.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (focusFact !== f.id) onEvidenceOpen?.();
                    setFocusFact(focusFact === f.id ? null : f.id);
                  }}
                  aria-expanded={focusFact === f.id}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm leading-6 text-ink transition-colors duration-200 hover:bg-canvas",
                    focusFact === f.id && "bg-canvas",
                  )}
                >
                  <CircleCheck aria-hidden className="mt-1 size-3.5 shrink-0 text-green" />
                  <span className="flex-1">{f.text}</span>
                  <span className="mt-0.5 shrink-0 rounded bg-ink/[0.05] px-1.5 text-[11px] font-medium leading-5 text-slate">
                    {f.evidenceIds.length} source
                  </span>
                </button>
                {focusFact === f.id ? (
                  <div className="mb-2 ml-7 mt-1 space-y-1.5">
                    {f.evidenceIds.map((id) => {
                      const e = evidenceById.get(id);
                      return e ? <EvidenceItem key={id} evidence={e} defaultOpen onOpen={onEvidenceOpen} live={live} /> : null;
                    })}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate">No facts could be collected from permitted sources.</p>
        )}
      </section>

      <section aria-labelledby={`${brief.id}-opps`}>
        <h4 id={`${brief.id}-opps`} className="mb-2 flex flex-wrap items-center gap-2 font-sans text-[13px] font-semibold text-ink">
          <Lightbulb aria-hidden className="size-4 text-info-fg" /> Possible opportunities <AiSuggestionBadge />
        </h4>
        {brief.opportunities.length ? (
          <ul className="space-y-2">
            {brief.opportunities.map((o) => (
              <li key={o.id} className="rounded-[10px] border border-dashed border-info-fg/30 bg-info-bg/40 px-3 py-2.5">
                <p className="text-sm leading-6 text-ink">{o.text}</p>
                <p className="mt-0.5 text-[13px] leading-5 text-slate">{o.relevance}</p>
                <p className="mt-1.5 text-[11px] text-slate">
                  Based on: {o.basedOnFactIds.map((fid) => brief.facts.find((f) => f.id === fid)?.text).filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate">No opportunity stands out for this offer.</p>
        )}
        <div className="mt-3 rounded-[10px] bg-mint-soft/70 px-3 py-2.5 text-sm leading-6 text-ink">
          <span className="font-semibold text-green">Suggested angle. </span>
          {brief.angle}
        </div>
      </section>

      <section aria-labelledby={`${brief.id}-unknowns`}>
        <h4 id={`${brief.id}-unknowns`} className="mb-2 flex items-center gap-2 font-sans text-[13px] font-semibold text-ink">
          <CircleHelp aria-hidden className="size-4 text-slate" /> Unknown
        </h4>
        <ul className="space-y-1 text-[13px] leading-5 text-slate">
          {brief.unknowns.map((u) => (
            <li key={u} className="flex gap-2">
              <CircleDashed aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {u}
            </li>
          ))}
        </ul>
      </section>

      {showRubric ? <RubricTable brief={brief} /> : null}
    </div>
  );
}

export function RubricTable({ brief }: { brief: OpportunityBrief }) {
  return (
    <section aria-labelledby={`${brief.id}-rubric`} className="rounded-[12px] border border-line bg-canvas/60 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 id={`${brief.id}-rubric`} className="font-sans text-[13px] font-semibold text-ink">
          Fit rubric
        </h4>
        <span className="text-xs tabular-nums text-slate">
          {brief.fit.points} of {brief.fit.maxTotal} points · {brief.confidence.reason}
        </span>
      </div>
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">Scoring criteria for this offer</caption>
        <thead className="sr-only">
          <tr>
            <th>Result</th>
            <th>Criterion</th>
            <th>Weight</th>
          </tr>
        </thead>
        <tbody>
          {brief.rubric.map((r) => (
            <tr key={r.id} className="border-t border-line first:border-t-0">
              <td className="w-6 py-1.5 align-top">
                {r.met === true ? (
                  <CircleCheck aria-label="Met" className="mt-0.5 size-3.5 text-green" />
                ) : r.met === false ? (
                  <CircleMinus aria-label="Not met" className="mt-0.5 size-3.5 text-slate" />
                ) : (
                  <CircleHelp aria-label="Unknown" className="mt-0.5 size-3.5 text-warn-fg" />
                )}
              </td>
              <td className="py-1.5 pr-2 align-top leading-5">
                <span className="text-ink">{r.criterion}</span>
                {r.met === null ? <span className="text-warn-fg"> · Unknown, not counted</span> : null}
                <span className="block text-xs text-slate">{r.note}</span>
              </td>
              <td className="w-10 py-1.5 text-right align-top tabular-nums text-slate">+{r.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs leading-5 text-slate">
        Strong at 60% of points, moderate at 35%. Fit helps you prioritise. It is not a prediction that a business will buy.
      </p>
    </section>
  );
}
