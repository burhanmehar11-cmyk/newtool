import type * as React from "react";
import { AtSign, CalendarCheck, CheckCircle2, MapPinned, Reply, Send, Sparkles, TrendingUp } from "lucide-react";
import { discoveryNiches } from "@/lib/discovery/niches";
import { CountUp } from "./count-up";
import { DraftingCard } from "./drafting-card";
import { featured } from "./sample-data";

/**
 * "Sample campaign" card: what one Locenti campaign can look like, from
 * businesses found on Google Maps to replies and booked calls. Every figure
 * here is example data from a fictional campaign and is labelled as such.
 * Followed by an endless strip of business types you can search.
 */

// Example figures, kept internally consistent (emails found <= businesses, replies / sent = reply rate).
const FOUND = 1284;
const EMAILS = 912;
const SENT = 846;
const DAILY_REPLIES = [3, 4, 4, 5, 5, 6, 7, 6, 8, 8, 9, 10, 10, 12];
const REPLIES = DAILY_REPLIES.reduce((a, b) => a + b, 0); // 97
const INTERESTED = 31;
const MEETINGS = 14;
const REPLY_RATE = Math.round((REPLIES / SENT) * 1000) / 10; // 11.5

const tiles: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; hint: string }[] = [
  { icon: MapPinned, label: "Businesses", value: FOUND, hint: "found on Google Maps" },
  { icon: AtSign, label: "Emails found", value: EMAILS, hint: `${Math.round((EMAILS / FOUND) * 100)}% of businesses` },
  { icon: Send, label: "Emails sent", value: SENT, hint: "each one approved" },
  { icon: Reply, label: "Replies", value: REPLIES, hint: "sorted in your Inbox" },
];

const points = [
  "Businesses and their public emails, found for you",
  "A personal first email for each, approved by you",
  "Replies sorted, and outreach stopped when someone answers",
];

// Chart geometry (viewBox units)
const CW = 600;
const CH = 190;
const PAD = { l: 30, r: 14, t: 34, b: 26 };
const Y_MAX = 14;
const Y_TICKS = [0, 4, 8, 12];
const px = (i: number) => PAD.l + (i * (CW - PAD.l - PAD.r)) / (DAILY_REPLIES.length - 1);
const py = (v: number) => PAD.t + (1 - v / Y_MAX) * (CH - PAD.t - PAD.b);
const linePath = DAILY_REPLIES.map((v, i) => `${i ? "L" : "M"} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
const areaPath = `${linePath} L ${px(DAILY_REPLIES.length - 1)} ${py(0)} L ${px(0)} ${py(0)} Z`;
const lastX = px(DAILY_REPLIES.length - 1);
const lastY = py(DAILY_REPLIES[DAILY_REPLIES.length - 1]);

function RepliesChart() {
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="h-auto w-full" role="img" aria-label={`Replies per day over the last 14 days, rising from ${DAILY_REPLIES[0]} to ${DAILY_REPLIES[DAILY_REPLIES.length - 1]} (example data)`}>
      <defs>
        <linearGradient id="lc-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--chart-1)", stopOpacity: 0.22 }} />
          <stop offset="100%" style={{ stopColor: "var(--chart-1)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {Y_TICKS.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={CW - PAD.r} y1={py(t)} y2={py(t)} className="stroke-line" strokeWidth={1} strokeDasharray={t ? "3 4" : undefined} />
          <text x={PAD.l - 8} y={py(t) + 4} textAnchor="end" className="fill-slate text-[11px] tabular-nums max-sm:hidden">
            {t}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="url(#lc-area)" className="draw-fade" />
      <path d={linePath} pathLength={1} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className="draw-line" style={{ stroke: "var(--chart-1)" }} />
      {[0, 6, 13].map((i) => (
        <text key={i} x={px(i)} y={CH - 6} textAnchor={i === 0 ? "start" : i === 13 ? "end" : "middle"} className="fill-slate text-[11px] max-sm:text-[22px]">
          {i === 13 ? "Today" : `${13 - i} days ago`}
        </text>
      ))}
      <g className="draw-fade">
        <line x1={lastX} x2={lastX} y1={lastY} y2={py(0)} className="stroke-line-strong" strokeWidth={1} strokeDasharray="2 3" />
        <circle cx={lastX} cy={lastY} r={9} style={{ fill: "var(--chart-1)", opacity: 0.18 }} />
        <circle cx={lastX} cy={lastY} r={4.5} className="stroke-surface" strokeWidth={2} style={{ fill: "var(--chart-1)" }} />
        <rect className="fill-ink max-sm:hidden" x={lastX - 104} y={lastY - 34} width={96} height={24} rx={7} />
        <text x={lastX - 56} y={lastY - 18} textAnchor="middle" className="fill-surface text-[11.5px] font-semibold max-sm:hidden">
          12 replies today
        </text>
      </g>
    </svg>
  );
}

export function ProofBand() {
  const niches = [...discoveryNiches.map((n) => n.label), "Chiropractors", "Plumbers", "Restaurants", "Real estate agents", "Gyms", "Auto repair shops"];
  const names = featured.map((f) => f.business.name);
  return (
    <section aria-label="A sample Locenti campaign" className="overflow-x-clip border-b border-line bg-surface">
      <div className="container-page grid grid-cols-1 items-center gap-12 py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:gap-16 lg:py-24">
        <div data-reveal="left">
          <p className="eyebrow inline-flex items-center gap-2 text-green">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-green" />
            </span>
            Sample campaign
          </p>
          <h2 className="display-2 mt-4 text-ink">One search. A pipeline of local clients.</h2>
          <p className="mt-5 max-w-xl text-[17px] leading-8 text-slate">
            Here is what a single campaign can look like in Locenti: businesses found on Google Maps, public emails pulled from their websites, a personal first email for each, and every reply sorted for you.
          </p>
          <ul className="mt-7 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] text-ink">
                <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-green" />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-7 max-w-md text-xs leading-5 text-slate">
            Example figures from a fictional campaign, shown for illustration. Your results depend on your market, your list and your offer.
          </p>
        </div>

        <div className="relative" data-reveal="scale">
          <div aria-hidden className="pointer-events-none absolute -inset-6 rounded-[40px] bg-mint/25 blur-3xl" />
          <div className="relative rounded-3xl border border-line bg-canvas/60 p-2 shadow-[var(--shadow-float)] backdrop-blur">
            <div className="rounded-[20px] border border-line bg-surface p-5 pb-12 sm:p-6 sm:pb-14">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-green">
                    <TrendingUp aria-hidden className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-[17px] font-semibold text-ink">Dentists in Austin, TX</p>
                    <p className="text-xs text-slate">Sample campaign · example data</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-2.5 py-1 text-xs font-semibold text-green">
                  <span className="size-1.5 animate-pulse rounded-full bg-green" /> Running
                </span>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {tiles.map((t) => {
                  const Icon = t.icon;
                  return (
                    <div key={t.label} className="rounded-2xl border border-line bg-canvas/70 p-3.5">
                      <dt className="flex items-center gap-1.5 text-xs font-medium text-slate">
                        <Icon aria-hidden className="size-3.5 text-green" />
                        {t.label}
                      </dt>
                      <dd className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink">
                        <CountUp to={t.value} />
                      </dd>
                      <dd className="mt-0.5 text-[11px] text-slate">{t.hint}</dd>
                    </div>
                  );
                })}
              </dl>

              <div className="mt-4 rounded-2xl border border-line bg-canvas/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">Replies per day</p>
                  <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-slate">Last 14 days</span>
                </div>
                <div className="mt-2">
                  <RepliesChart />
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line">
                {[
                  { icon: TrendingUp, label: "Reply rate", node: <><CountUp to={REPLY_RATE} decimals={1} />%</> },
                  { icon: Sparkles, label: "Interested", node: <CountUp to={INTERESTED} /> },
                  { icon: CalendarCheck, label: "Meetings booked", node: <CountUp to={MEETINGS} /> },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label} className="px-3 py-3 sm:px-4">
                      <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate sm:text-xs">
                        <Icon aria-hidden className="size-3.5 shrink-0 text-green max-sm:hidden" />
                        <span className="leading-4">{m.label}</span>
                      </dt>
                      <dd className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">{m.node}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </div>
          <div className="relative z-10 -mt-9 ml-4 mr-4 sm:ml-auto sm:mr-8 sm:max-w-sm">
            <DraftingCard names={names} />
          </div>
        </div>
      </div>

      <div className="marquee overflow-hidden border-t border-line py-4">
        <ul className="marquee-track flex w-max gap-3" aria-label="Business types you can search">
          {[...niches, ...niches].map((n, i) => (
            <li key={`${n}-${i}`} aria-hidden={i >= niches.length || undefined} className="whitespace-nowrap rounded-full border border-line bg-canvas px-3.5 py-1.5 text-sm font-medium text-ink">
              {n}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
