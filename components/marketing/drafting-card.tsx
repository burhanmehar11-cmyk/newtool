"use client";

import * as React from "react";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = ["Reading the website…", "Picking a detail worth mentioning…", "Writing the first line…", "Ready for your review"];
const TICK_MS = 1500;

/**
 * Small self-playing card: Locenti preparing a personal first email for one
 * fictional business after another. Pauses off-screen; reduced-motion
 * visitors see a still, finished state.
 */
export function DraftingCard({ names }: { names: string[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [tick, setTick] = React.useState(STAGES.length - 1);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(([e]) => {
      clearInterval(timer);
      if (e.isIntersecting) timer = setInterval(() => setTick((t) => t + 1), TICK_MS);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  }, []);

  const stage = tick % STAGES.length;
  const name = names[Math.floor(tick / STAGES.length) % names.length];
  const done = stage === STAGES.length - 1;

  return (
    <div ref={ref} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-float)]">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-green">
          <PenLine aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1" aria-live="off">
          <p className="truncate text-sm font-semibold text-ink">
            Drafting a personal email for <span className="text-green">{name}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-slate">
            {done ? <CheckCircle2 aria-hidden className="size-3.5 text-green" /> : <Loader2 aria-hidden className="size-3.5 animate-spin" />}
            {STAGES[stage]}
          </p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas">
        <div className={cn("h-full rounded-full bg-green transition-[width] duration-700 ease-out")} style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }} />
      </div>
    </div>
  );
}
