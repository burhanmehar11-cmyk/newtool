"use client";

import * as React from "react";
import type { DayPoint } from "@/server/analytics-store";

const SERIES = [
  { key: "sent", label: "Sent", color: "var(--chart-1)" },
  { key: "replied", label: "Replies", color: "var(--chart-2)" },
] as const;

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Sent vs replies per day: one axis (both are counts), crosshair tooltip, legend, table view. */
export function TrendChart({ data }: { data: DayPoint[] }) {
  const ref = React.useRef<SVGSVGElement>(null);
  const [hover, setHover] = React.useState<number | null>(null);
  const W = 720;
  const H = 240;
  const pad = { l: 34, r: 16, t: 12, b: 26 };
  const max = Math.max(4, ...data.flatMap((d) => [d.sent, d.replied]));
  const niceMax = Math.ceil(max / 4) * 4;
  const x = (i: number) => pad.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b);
  const path = (k: "sent" | "replied") => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  const ticks = [0, 1, 2, 3, 4].map((t) => (niceMax / 4) * t);
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));
  const total = (k: "sent" | "replied") => data.reduce((a, d) => a + d[k], 0);

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };
  const h = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} /> {s.label} <span className="font-medium tabular-nums text-ink">{total(s.key)}</span>
          </span>
        ))}
      </div>
      <div className="relative">
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none" role="img" aria-label={`Sent and replies per day: ${total("sent")} sent, ${total("replied")} replies`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--color-slate)">
                {Math.round(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 || i === data.length - 1 ? (
              <text key={d.day} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-slate)">
                {fmtDay(d.day)}
              </text>
            ) : null,
          )}
          {SERIES.map((s) => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {h !== null && hover !== null ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--color-line-strong)" strokeWidth={1} strokeDasharray="3 3" />
              {SERIES.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(h[s.key])} r={4.5} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />
              ))}
            </g>
          ) : null}
        </svg>
        {h !== null && hover !== null ? (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-float"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > data.length / 2 ? "-110%" : "10%"})` }}
          >
            <p className="font-medium text-ink">{fmtDay(h.day)}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-1 flex items-center gap-2 text-slate">
                <span className="size-2 rounded-full" style={{ background: s.color }} /> {s.label} <span className="ml-auto font-medium tabular-nums text-ink">{h[s.key]}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <details className="mt-2 text-xs text-slate">
        <summary className="cursor-pointer select-none hover:text-ink">View as table</summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line scrollbar-thin">
          <table className="w-full text-left">
            <thead className="bg-canvas text-slate">
              <tr>
                <th className="px-3 py-1.5 font-medium">Day</th>
                <th className="px-3 py-1.5 text-right font-medium">Sent</th>
                <th className="px-3 py-1.5 text-right font-medium">Replies</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.day} className="border-t border-line text-ink">
                  <td className="px-3 py-1">{fmtDay(d.day)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{d.sent}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{d.replied}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
