"use client";

import * as React from "react";
import { CheckCircle2, FileSearch, Globe, Loader2, MapPinned, PenLine, Search, Send, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { featured } from "./sample-data";

/**
 * Self-playing product demo for the landing page, built from the real UI
 * pieces' look rather than a video: a Google Maps search types itself,
 * results stream in, a lead is researched, the email writes itself, and a
 * campaign launches. All businesses and numbers are fictional sample data.
 * Pauses when off-screen; reduced-motion visitors get the
 * finished state without animation.
 */

const QUERY = "Dentists in Austin, TX";
const STEPS = [
  { id: "search", label: "Search Google Maps", icon: MapPinned },
  { id: "research", label: "Research", icon: FileSearch },
  { id: "write", label: "Write", icon: PenLine },
  { id: "send", label: "Approve & send", icon: Send },
] as const;

type Phase = "typing" | "searching" | "results" | "brief" | "draft" | "launch" | "done";
const stepOf: Record<Phase, number> = { typing: 0, searching: 0, results: 0, brief: 1, draft: 2, launch: 3, done: 3 };

const rows = featured.map((f) => f.business);
const lead = featured[0];
const facts = lead.brief.facts.slice(0, 3);
const draftText = `Subject: ${lead.draft.subject}\n\n${lead.draft.body.split("\n\n").slice(0, 3).join("\n\n")}`;
const STATS = [
  { label: "Approved", value: 48 },
  { label: "Sent", value: 48 },
  { label: "Replies", value: 9 },
  { label: "Interested", value: 4 },
];

export function LiveDemo() {
  const root = React.useRef<HTMLDivElement>(null);
  const [phase, setPhase] = React.useState<Phase>("typing");
  const [typed, setTyped] = React.useState(0);
  const [shown, setShown] = React.useState(0);
  const [factsShown, setFactsShown] = React.useState(0);
  const [draftChars, setDraftChars] = React.useState(0);
  const [stat, setStat] = React.useState(0); // 0..1 progress of the count-up
  const [visible, setVisible] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    if (root.current) io.observe(root.current);
    return () => {
      mq.removeEventListener("change", apply);
      io.disconnect();
    };
  }, []);

  const running = visible && !reduced;

  // One timer per tick; each phase advances its own counter, then hands over.
  React.useEffect(() => {
    if (!running) return;
    let t: number;
    const next = (ms: number, fn: () => void) => (t = window.setTimeout(fn, ms));
    switch (phase) {
      case "typing":
        if (typed < QUERY.length) next(typed === 0 ? 350 : 32 + Math.random() * 22, () => setTyped((n) => n + 1));
        else next(250, () => setPhase("searching"));
        break;
      case "searching":
        next(650, () => setPhase("results"));
        break;
      case "results":
        if (shown < rows.length) next(130, () => setShown((n) => n + 1));
        else next(550, () => setPhase("brief"));
        break;
      case "brief":
        if (factsShown < facts.length) next(factsShown === 0 ? 280 : 380, () => setFactsShown((n) => n + 1));
        else next(950, () => setPhase("draft"));
        break;
      case "draft":
        if (draftChars < draftText.length) next(16, () => setDraftChars((n) => Math.min(draftText.length, n + 6)));
        else next(1100, () => setPhase("launch"));
        break;
      case "launch":
        if (stat < 1) next(16, () => setStat((s) => Math.min(1, s + 0.02)));
        else next(2200, () => setPhase("done"));
        break;
      case "done":
        next(200, () => {
          setTyped(0);
          setShown(0);
          setFactsShown(0);
          setDraftChars(0);
          setStat(0);
          setPhase("typing");
        });
        break;
    }
    return () => window.clearTimeout(t);
  }, [running, phase, typed, shown, factsShown, draftChars, stat]);

  const jump = (step: number) => {
    const p: Phase[] = ["results", "brief", "draft", "launch"];
    setTyped(QUERY.length);
    setShown(rows.length);
    setFactsShown(step >= 1 ? facts.length : 0);
    setDraftChars(step >= 2 ? (step > 2 ? draftText.length : 0) : 0);
    setStat(0);
    setPhase(p[step]);
  };

  // Reduced motion: show the finished state.
  const v = reduced
    ? { phase: "launch" as Phase, typed: QUERY.length, shown: rows.length, factsShown: facts.length, draftChars: draftText.length, stat: 1 }
    : { phase, typed, shown, factsShown, draftChars, stat };
  const step = stepOf[v.phase];
  const selected = v.phase !== "typing" && v.phase !== "searching" && v.phase !== "results";

  return (
    <div ref={root} className="relative">
      <div aria-hidden className="demo-glow pointer-events-none absolute -inset-px rounded-[20px]" />
      <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[#0e171f] shadow-dark">
        {/* Window bar */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </span>
          <ol className="flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-none" aria-label="Demo steps">
            {STEPS.map(({ id, label, icon: Icon }, i) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => jump(i)}
                  aria-current={i === step ? "step" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors duration-300",
                    i === step ? "bg-mint/15 text-mint" : i < step ? "text-white/60" : "text-white/35 hover:text-white/60",
                  )}
                >
                  {i < step ? <CheckCircle2 aria-hidden className="size-3.5" /> : <Icon aria-hidden className="size-3.5" />}
                  {label}
                </button>
              </li>
            ))}
          </ol>
          <span className="hidden shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-white/50 sm:inline">Sample data</span>
        </div>

        <div className="grid min-h-[440px] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Left: search and results */}
          <div className="border-b border-white/[0.07] p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5">
              <Search aria-hidden className="size-4 shrink-0 text-mint" />
              <span data-demo-query className="min-w-0 flex-1 truncate text-[14.5px] text-white">
                {QUERY.slice(0, v.typed)}
                {v.phase === "typing" ? <span aria-hidden className="demo-caret ml-px inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-mint" /> : null}
                {v.typed === 0 ? <span className="text-white/35">Describe who you want to reach</span> : null}
              </span>
              <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-all duration-300", v.phase === "searching" ? "bg-mint text-midnight" : "bg-white/[0.08] text-white/70")}>
                {v.phase === "searching" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <MapPinned aria-hidden className="size-3.5" />}
                {v.phase === "searching" ? "Searching…" : "Search"}
              </span>
            </div>
            <div className="mt-2 h-[2px] overflow-hidden rounded-full bg-white/[0.04]">
              <div className={cn("h-full rounded-full bg-gradient-to-r from-mint/0 via-mint to-mint/0", v.phase === "searching" ? "demo-scan" : "opacity-0")} />
            </div>

            <div className="mt-3 flex items-center justify-between text-[11.5px] text-white/45">
              <span>{v.shown ? `${v.shown} businesses · from Google Maps` : v.phase === "searching" ? "Looking up businesses…" : "Results appear here"}</span>
              {v.shown ? <span>Rating 4.0+ · has website</span> : null}
            </div>
            <ul className="mt-2 space-y-1.5">
              {rows.map((b, i) => {
                const on = i < v.shown;
                const active = selected && i === 0;
                return (
                  <li
                    key={b.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-500",
                      on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                      active ? "border-mint/40 bg-mint/[0.07]" : "border-white/[0.06] bg-white/[0.02]",
                    )}
                  >
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold", active ? "bg-mint text-midnight" : "bg-white/[0.06] text-white/70")}>
                      {b.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-white">{b.name}</span>
                      <span className="flex items-center gap-1 truncate text-[11.5px] text-white/45">
                        <Globe aria-hidden className="size-3" /> {b.domain}
                      </span>
                    </span>
                    {b.rating !== null ? (
                      <span className="hidden shrink-0 items-center gap-1 text-[12px] text-white/80 sm:inline-flex">
                        <Star aria-hidden className="size-3.5 fill-current text-[#f5b83d]" /> {b.rating.toFixed(1)}
                        <span className="text-white/40">({b.reviewCount})</span>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right: brief → draft → campaign */}
          <div className="relative p-4 sm:p-5">
            {!selected ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
                <span className="flex size-11 items-center justify-center rounded-xl bg-white/[0.05] text-white/40">
                  <FileSearch aria-hidden className="size-5" />
                </span>
                <p className="mt-3 max-w-[220px] text-[13px] leading-5 text-white/45">Pick a business to see what its website shows and why it may need you.</p>
              </div>
            ) : v.phase === "brief" ? (
              <div key="brief" className="demo-panel">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mint">Opportunity Brief</p>
                <p className="mt-1 text-[15px] font-semibold text-white">{lead.business.name}</p>
                <ul className="mt-4 space-y-2.5">
                  {facts.map((f, i) => (
                    <li key={f.id} className={cn("rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 transition-all duration-500", i < v.factsShown ? "opacity-100" : "translate-y-1 opacity-0")}>
                      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/40">Observed · source linked</span>
                      <span className="mt-1 block text-[12.5px] leading-5 text-white/85">{f.text}</span>
                    </li>
                  ))}
                </ul>
                <p className={cn("mt-4 rounded-lg bg-mint/10 px-3 py-2 text-[12px] leading-5 text-mint transition-opacity duration-500", v.factsShown >= facts.length ? "opacity-100" : "opacity-0")}>
                  Fit: {lead.brief.fit.level}. Angle: {lead.brief.angle}
                </p>
              </div>
            ) : v.phase === "draft" ? (
              <div key="draft" className="demo-panel">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mint">Draft · from the brief</p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-[12.5px] leading-[1.6] text-white/85">
                  {draftText.slice(0, v.draftChars)}
                  <span aria-hidden className="demo-caret ml-px inline-block h-[1em] w-[2px] translate-y-[2px] bg-mint" />
                </pre>
              </div>
            ) : (
              <div key="launch" className="demo-panel">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mint">Campaign · approved by you</p>
                <p className="mt-1 text-[15px] font-semibold text-white">Austin dentists</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {STATS.map((s) => (
                    <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                      <p className="text-[11px] text-white/45">{s.label}</p>
                      <p className="font-display text-2xl font-semibold tabular-nums text-white">{Math.round(s.value * ease(v.stat))}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-[11px] text-white/45">
                    <span>Sending from your Gmail · 25/day · business hours</span>
                    <span>{Math.round(ease(v.stat) * 100)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-green to-mint transition-[width] duration-100" style={{ width: `${ease(v.stat) * 100}%` }} />
                  </div>
                </div>
                <p className="mt-4 text-[11px] leading-5 text-white/40">Sample campaign, time compressed. Real campaigns send a few minutes apart within your daily limit.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ease(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
