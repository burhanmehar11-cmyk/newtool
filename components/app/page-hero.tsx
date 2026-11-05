import type * as React from "react";
import { cn } from "@/lib/utils";

export type HeroStat = { label: string; value: string; hint?: string };

/**
 * Premium page header used across the app: icon, title, description,
 * actions, and a strip of live stats for the page.
 */
export function PageHero({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  stats,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  stats?: HeroStat[];
  className?: string;
}) {
  return (
    <section className={cn("card relative mb-6 overflow-hidden", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green via-mint to-green/30" />
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-mint/20 blur-3xl" />
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-7">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-mint-soft text-green shadow-sm">
            <Icon className="size-6" />
          </span>
          <div className="min-w-0">
            {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.08em] text-green">{eyebrow}</p> : null}
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
            {description ? <p className="mt-1.5 max-w-2xl text-[15px] leading-6 text-slate">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-start gap-2">{actions}</div> : null}
      </div>
      {stats?.length ? (
        <dl className={cn("relative grid border-t border-line", stats.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : stats.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2")}>
          {stats.map((s, i) => (
            <div key={s.label} className={cn("px-6 py-4 sm:px-7", i > 0 && "border-l border-line", stats.length >= 4 && i === 2 && "max-lg:border-l-0", stats.length >= 4 && i >= 2 && "max-lg:border-t")}>
              <dt className="text-xs font-medium text-slate">{s.label}</dt>
              <dd className="mt-0.5 font-display text-2xl font-semibold tabular-nums text-ink">{s.value}</dd>
              {s.hint ? <dd className="text-xs text-slate">{s.hint}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

/** A row of numbered "how this page works" steps, shown on emptier pages. */
export function StepGuide({ steps }: { steps: { title: string; text: string }[] }) {
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.title} className="card flex gap-3 p-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-green/40 font-display text-sm font-bold text-green">{i + 1}</span>
          <span>
            <span className="block text-sm font-semibold text-ink">{s.title}</span>
            <span className="mt-0.5 block text-[13px] leading-5 text-slate">{s.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
