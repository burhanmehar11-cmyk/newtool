import type * as React from "react";
import { Ban, CalendarClock, CircleHelp, Inbox, MailX, Reply, Sparkles, UserX } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { brand } from "@/config/brand";

/**
 * "Every reply, handled": what Locenti does with replies to campaign emails.
 * Matches real behaviour (reply tracking): it labels, stops outreach and
 * protects the do-not-contact list; it never answers on your behalf.
 * Desktop shows a connected diagram with dots flowing into and out of the
 * centre; smaller screens show the same items as two lists.
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
  { icon: CircleHelp, title: "Needs a look", text: "Questions and unclear replies wait for you", tone: "text-orange-400 bg-orange-400/10" },
  { icon: UserX, title: "Not interested", text: "Stopped politely; a request to stop is honoured", tone: "text-rose-400 bg-rose-400/10" },
];

// Diagram geometry (viewBox units). Cards sit at these vertical centres.
const W = 1200;
const H = 470;
const CX = W / 2;
const CY = H / 2;
const inY = [70, 180, 290, 400];
const outY = [100, 235, 370];
const CARD_W = 340;

const leftPath = (y: number) => `M ${CARD_W} ${y} C ${CARD_W + 130} ${y}, ${CX - 170} ${CY}, ${CX - 70} ${CY}`;
const rightPath = (y: number) => `M ${CX + 70} ${CY} C ${CX + 170} ${CY}, ${W - CARD_W - 130} ${y}, ${W - CARD_W} ${y}`;

function Card({ item, style }: { item: Item; style?: React.CSSProperties }) {
  const Icon = item.icon;
  return (
    <div style={style} className="flex items-center gap-3.5 rounded-2xl border border-mint/25 bg-[#0f1a21]/90 p-4 shadow-[0_0_0_1px_rgb(143_240_192/0.05),0_20px_40px_-20px_rgb(0_0_0/0.8)] backdrop-blur-sm">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-white">{item.title}</span>
        <span className="block text-[13px] leading-5 text-white/60">{item.text}</span>
      </span>
    </div>
  );
}

export function ReplyFlow() {
  return (
    <section className="on-dark relative overflow-hidden bg-midnight py-20 text-white sm:py-28">
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
                <stop offset="0%" stopColor="#8ff0c0" stopOpacity="0.15" />
                <stop offset="50%" stopColor="#8ff0c0" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#8ff0c0" stopOpacity="0.15" />
              </linearGradient>
            </defs>
            {inY.map((y, i) => (
              <g key={`in${i}`}>
                <path id={`rf-in-${i}`} d={leftPath(y)} fill="none" stroke="url(#rf-line)" strokeWidth={2} />
                <circle r={4} fill="#ffffff" className="flow-dot">
                  <animateMotion dur="3.2s" begin={`-${(i * 0.8).toFixed(1)}s`} repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                    <mpath href={`#rf-in-${i}`} />
                  </animateMotion>
                </circle>
              </g>
            ))}
            {outY.map((y, i) => (
              <g key={`out${i}`}>
                <path id={`rf-out-${i}`} d={rightPath(y)} fill="none" stroke="url(#rf-line)" strokeWidth={2} />
                <circle r={4} fill="#8ff0c0" className="flow-dot">
                  <animateMotion dur="3.2s" begin={`-${(0.4 + i * 1.1).toFixed(1)}s`} repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                    <mpath href={`#rf-out-${i}`} />
                  </animateMotion>
                </circle>
              </g>
            ))}
          </svg>

          {IN.map((item, i) => (
            <Card key={item.title} item={item} style={{ position: "absolute", left: 0, width: `${(CARD_W / W) * 100}%`, top: `${(inY[i] / H) * 100}%`, transform: "translateY(-50%)" }} />
          ))}
          {OUT.map((item, i) => (
            <Card key={item.title} item={item} style={{ position: "absolute", right: 0, width: `${(CARD_W / W) * 100}%`, top: `${(outY[i] / H) * 100}%`, transform: "translateY(-50%)" }} />
          ))}

          <div className="absolute flex flex-col items-center" style={{ left: "50%", top: `${(CY / H) * 100}%`, transform: "translate(-50%, -50%)" }}>
            <div className="relative flex size-[132px] items-center justify-center rounded-[28px] border border-mint/40 bg-[#0f1a21] shadow-[0_0_60px_-10px_rgb(143_240_192/0.5)]">
              <span aria-hidden className="flow-pulse absolute inset-0 rounded-[28px] border border-mint/40" />
              <LogoMark className="size-14 text-mint" />
            </div>
            <p className="mt-3 font-display text-lg font-semibold text-white">{brand.name}</p>
          </div>
        </div>

        {/* Smaller screens: the same, as two lists */}
        <div className="mx-auto mt-12 grid max-w-xl gap-8 xl:hidden">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">When this happens</p>
            <div className="space-y-3">
              {IN.map((item) => (
                <Card key={item.title} item={item} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 text-mint">
            <span className="h-px flex-1 bg-mint/30" />
            <LogoMark className="size-8" />
            <span className="h-px flex-1 bg-mint/30" />
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">{brand.name} does this</p>
            <div className="space-y-3">
              {OUT.map((item) => (
                <Card key={item.title} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
