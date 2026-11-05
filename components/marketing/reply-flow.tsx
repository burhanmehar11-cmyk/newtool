"use client";

import * as React from "react";
import { Ban, CalendarClock, CircleHelp, Inbox, MailX, OctagonX, Reply, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * "Every reply, handled": what Locenti does with replies to campaign emails.
 * Plays example replies (fictional businesses) one at a time: the incoming
 * card lights up, a pulse travels into Locenti, the reply and what happened
 * to it appear in the middle, and a pulse travels on to the outcome, whose
 * count goes up. Matches real behaviour: it labels, stops outreach and keeps
 * the do-not-contact list; it never answers on your behalf.
 * Pauses off-screen; reduced motion shows a still frame.
 */

type Item = { icon: React.ComponentType<{ className?: string }>; title: string; text: string; tone: string };

const IN: Item[] = [
  { icon: Reply, title: "A lead replies", text: "No more emails go to them from that campaign", tone: "text-sky-400 bg-sky-400/10" },
  { icon: CalendarClock, title: "Out of office", text: "Labelled, and not counted as an answer", tone: "text-violet-400 bg-violet-400/10" },
  { icon: MailX, title: "Bounced email", text: "Outreach stops and the address is blocked", tone: "text-cyan-400 bg-cyan-400/10" },
  { icon: Ban, title: "Unsubscribe", text: "Added to your do-not-contact list for good", tone: "text-amber-400 bg-amber-400/10" },
];

const OUT: Item[] = [
  { icon: Sparkles, title: "Interested", text: "Flagged in your Inbox so you reply while it's warm", tone: "text-emerald-400 bg-emerald-400/10" },
  { icon: CircleHelp, title: "Needs a look", text: "Questions and out-of-office replies wait in your Inbox", tone: "text-orange-400 bg-orange-400/10" },
  { icon: OctagonX, title: "Stopped", text: "Not interested, bounced or unsubscribed: no more emails", tone: "text-rose-400 bg-rose-400/10" },
];

/** Example replies from fictional businesses. */
const SCENES: { from: number; to: number; who: string; quote: string; action: string }[] = [
  { from: 0, to: 0, who: "Riverbend Dental", quote: "Sounds great. Could we talk on Thursday?", action: "Interested · follow-ups stop" },
  { from: 0, to: 1, who: "Oak Hill Family Dentistry", quote: "What would this cost for a small practice?", action: "Needs a look · waits for you" },
  { from: 1, to: 1, who: "Lakeview Smiles", quote: "I'm out of the office until Monday.", action: "Out of office · not an answer" },
  { from: 0, to: 2, who: "Bluebonnet Dental", quote: "No thanks, we're all set for now.", action: "Not interested · no more emails" },
  { from: 2, to: 2, who: "Mail server", quote: "Delivery failed: address not found.", action: "Bounced · address blocked" },
  { from: 3, to: 2, who: "Cedar Park Dental", quote: "Please remove me from your list.", action: "Unsubscribed · never emailed again" },
];

// Timeline of one scene (ms)
const T_IN = 1000; // pulse travels into Locenti
const T_OUT = 1700; // pulse leaves for the outcome
const T_LAND = 2600; // outcome counted
const T_NEXT = 3300;

// Diagram geometry (viewBox units). Cards sit at these vertical centres.
const W = 1200;
const H = 540;
const CX = W / 2;
const CY = 222;
const inY = [58, 167, 276, 385];
const outY = [96, 222, 348];
const CARD_W = 340;

const leftPath = (y: number) => `M ${CARD_W} ${y} C ${CARD_W + 130} ${y}, ${CX - 170} ${CY}, ${CX - 70} ${CY}`;
const rightPath = (y: number) => `M ${CX + 70} ${CY} C ${CX + 170} ${CY}, ${W - CARD_W - 130} ${y}, ${W - CARD_W} ${y}`;

type Phase = "in" | "center" | "out" | "landed";

function useScenes() {
  const root = React.useRef<HTMLElement>(null);
  const [scene, setScene] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>("landed");
  const [counts, setCounts] = React.useState([0, 0, 0]);
  const [running, setRunning] = React.useState(false);

  React.useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    if (!running) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    at(0, () => setPhase("in"));
    at(T_IN, () => setPhase("center"));
    at(T_OUT, () => setPhase("out"));
    at(T_LAND, () => {
      setPhase("landed");
      setCounts((c) => c.map((n, i) => (i === SCENES[scene].to ? n + 1 : n)));
    });
    at(T_NEXT, () => setScene((s) => (s + 1) % SCENES.length));
    return () => timers.forEach(clearTimeout);
  }, [running, scene]);

  return { root, scene: SCENES[scene], sceneIndex: scene, phase, counts, running };
}

function Card({ item, active, count, style }: { item: Item; active?: boolean; count?: number; style?: React.CSSProperties }) {
  const Icon = item.icon;
  return (
    <div
      style={style}
      className={cn(
        "flex items-center gap-3.5 rounded-2xl border bg-[#0f1a21]/90 p-4 backdrop-blur-sm transition-[border-color,box-shadow,background-color] duration-500",
        active ? "border-mint/70 bg-[#13232b] shadow-[0_0_0_1px_rgb(143_240_192/0.35),0_0_36px_-6px_rgb(143_240_192/0.45)]" : "border-mint/20 shadow-[0_20px_40px_-20px_rgb(0_0_0/0.8)]",
      )}
    >
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-500", item.tone, active && "scale-110")}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-white">{item.title}</span>
        <span className="block text-[13px] leading-5 text-white/60">{item.text}</span>
      </span>
      {count !== undefined ? (
        <span key={count} className={cn("flow-count shrink-0 rounded-full border px-2.5 py-1 font-display text-sm font-semibold tabular-nums", active ? "border-mint/60 bg-mint/15 text-mint" : "border-white/15 text-white/70")}>
          {count}
        </span>
      ) : null}
    </div>
  );
}

function ReplyBubble({ scene, phase, sceneIndex, className }: { scene: (typeof SCENES)[number]; phase: Phase; sceneIndex: number; className?: string }) {
  return (
    <div key={sceneIndex} className={cn("flow-bubble rounded-2xl border border-white/12 bg-[#0f1a21]/95 p-4 text-left shadow-[0_24px_48px_-20px_rgb(0_0_0/0.9)]", className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/45">
        <Reply aria-hidden className="size-3" /> {scene.who}
      </p>
      <p className="mt-1.5 text-[15px] leading-6 text-white">&ldquo;{scene.quote}&rdquo;</p>
      <p className={cn("mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-mint/12 px-2.5 py-1 text-xs font-medium text-mint transition-opacity duration-300", phase === "in" ? "opacity-0" : "opacity-100")}>
        <span className="size-1.5 rounded-full bg-mint" /> {scene.action}
      </p>
    </div>
  );
}

export function ReplyFlow() {
  const { root, scene, sceneIndex, phase, counts, running } = useScenes();
  const inActive = phase === "in" || phase === "center";
  const outActive = phase === "out" || phase === "landed";

  return (
    <section ref={root} className="on-dark relative overflow-hidden bg-midnight py-20 text-white sm:py-28">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint/[0.07] blur-3xl" />
      <div className="container-page relative">
        <div className="mx-auto max-w-3xl text-center" data-reveal>
          <p className="eyebrow inline-flex items-center gap-2 text-mint">
            <Inbox aria-hidden className="size-3.5" /> Reply tracking
          </p>
          <h2 className="display-2 mt-4 text-white">
            Every reply, handled <span className="text-shine">the right way.</span>
          </h2>
          <p className="mt-5 text-[17px] leading-8 text-white/70">
            {brand.name} reads the replies to your campaign emails, sorts them, and stops outreach the moment someone answers, bounces or opts out. What to say next stays your call.
          </p>
        </div>

        {/* Desktop: connected diagram */}
        <div className="relative mx-auto mt-14 hidden max-w-[1200px] xl:block" style={{ aspectRatio: `${W} / ${H}` }} data-reveal="scale">
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
            <defs>
              <linearGradient id="rf-line" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#8ff0c0" stopOpacity="0.12" />
                <stop offset="50%" stopColor="#8ff0c0" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#8ff0c0" stopOpacity="0.12" />
              </linearGradient>
            </defs>
            {inY.map((y, i) => {
              const active = running && inActive && scene.from === i;
              return (
                <g key={`in${i}`}>
                  <path id={`rf-in-${i}`} d={leftPath(y)} fill="none" stroke={active ? "#8ff0c0" : "url(#rf-line)"} strokeOpacity={active ? 0.8 : 1} strokeWidth={active ? 2.5 : 1.5} className="transition-all duration-300" />
                  <circle r={3} fill="#ffffff" opacity={0.55} className="flow-dot">
                    <animateMotion dur="3.6s" begin={`-${(i * 0.9).toFixed(1)}s`} repeatCount="indefinite">
                      <mpath href={`#rf-in-${i}`} />
                    </animateMotion>
                  </circle>
                </g>
              );
            })}
            {outY.map((y, i) => {
              const active = running && outActive && scene.to === i;
              return (
                <g key={`out${i}`}>
                  <path id={`rf-out-${i}`} d={rightPath(y)} fill="none" stroke={active ? "#8ff0c0" : "url(#rf-line)"} strokeOpacity={active ? 0.8 : 1} strokeWidth={active ? 2.5 : 1.5} className="transition-all duration-300" />
                  <circle r={3} fill="#8ff0c0" opacity={0.6} className="flow-dot">
                    <animateMotion dur="3.6s" begin={`-${(0.6 + i * 1.2).toFixed(1)}s`} repeatCount="indefinite">
                      <mpath href={`#rf-out-${i}`} />
                    </animateMotion>
                  </circle>
                </g>
              );
            })}
            {/* The current reply: a bright pulse in, then out to its outcome. */}
            {running && phase === "in" ? <path key={`ci${sceneIndex}`} d={leftPath(inY[scene.from])} pathLength={1} className="flow-comet" style={{ animationDuration: `${T_IN}ms` }} /> : null}
            {running && phase === "out" ? <path key={`co${sceneIndex}`} d={rightPath(outY[scene.to])} pathLength={1} className="flow-comet" style={{ animationDuration: `${T_LAND - T_OUT}ms` }} /> : null}
          </svg>

          {IN.map((item, i) => (
            <Card key={item.title} item={item} active={running && inActive && scene.from === i} style={{ position: "absolute", left: 0, width: `${(CARD_W / W) * 100}%`, top: `${(inY[i] / H) * 100}%`, transform: "translateY(-50%)" }} />
          ))}
          {OUT.map((item, i) => (
            <Card key={item.title} item={item} count={counts[i]} active={running && outActive && scene.to === i} style={{ position: "absolute", right: 0, width: `${(CARD_W / W) * 100}%`, top: `${(outY[i] / H) * 100}%`, transform: "translateY(-50%)" }} />
          ))}

          <div className="absolute flex flex-col items-center" style={{ left: "50%", top: `${(CY / H) * 100}%`, transform: "translate(-50%, -50%)" }}>
            <div className={cn("relative flex size-[124px] items-center justify-center rounded-[28px] border bg-[#0f1a21] transition-[box-shadow,border-color] duration-500", running && phase === "center" ? "border-mint/80 shadow-[0_0_80px_-6px_rgb(143_240_192/0.75)]" : "border-mint/40 shadow-[0_0_60px_-10px_rgb(143_240_192/0.5)]")}>
              <span aria-hidden className="flow-pulse absolute inset-0 rounded-[28px] border border-mint/40" />
              <LogoMark className="size-14 text-mint" />
            </div>
          </div>
          <div className="absolute w-[min(330px,30%)]" style={{ left: "50%", top: `${((CY + 88) / H) * 100}%`, transform: "translateX(-50%)" }}>
            <ReplyBubble scene={scene} phase={running ? phase : "landed"} sceneIndex={sceneIndex} />
          </div>
        </div>

        {/* Smaller screens: the same, as two lists around the live reply */}
        <div className="mx-auto mt-12 grid max-w-xl gap-6 xl:hidden">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">When this happens</p>
            <div className="space-y-3">
              {IN.map((item, i) => (
                <Card key={item.title} item={item} active={running && inActive && scene.from === i} />
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-mint/40 bg-[#0f1a21] text-mint">
              <LogoMark className="size-7" />
            </span>
            <ReplyBubble scene={scene} phase={running ? phase : "landed"} sceneIndex={sceneIndex} className="w-full" />
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">{brand.name} does this</p>
            <div className="space-y-3">
              {OUT.map((item, i) => (
                <Card key={item.title} item={item} count={counts[i]} active={running && outActive && scene.to === i} />
              ))}
            </div>
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-white/40">Example replies from fictional businesses, played on a loop. Counts show replies handled in this preview.</p>
      </div>
    </section>
  );
}
