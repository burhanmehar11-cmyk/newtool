import Link from "next/link";
import type * as React from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Inbox, Mail, MinusCircle, Send, UserPlus } from "lucide-react";
import type { Activity, Breakdown, CampaignStat, Funnel } from "@/server/analytics-store";
import { cn, formatDateTime } from "@/lib/utils";

export function pct(part: number, whole: number) {
  return whole ? `${(Math.round((part / whole) * 1000) / 10).toFixed(1)}%` : "–";
}

/** A KPI tile: value, label, and change vs the previous period. */
export function Kpi({ label, value, sub, delta, invert, icon: Icon }: { label: string; value: string; sub?: string; delta?: number | null; invert?: boolean; icon?: React.ComponentType<{ className?: string }> }) {
  const good = delta !== undefined && delta !== null && (invert ? delta < 0 : delta > 0);
  const bad = delta !== undefined && delta !== null && (invert ? delta > 0 : delta < 0);
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate">{label}</p>
        {Icon ? <Icon aria-hidden className="size-4 text-slate" /> : null}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-slate">
        {delta !== undefined && delta !== null && delta !== 0 ? (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", good && "text-green", bad && "text-danger-fg")}>
            {delta > 0 ? <ArrowUpRight aria-hidden className="size-3.5" /> : <ArrowDownRight aria-hidden className="size-3.5" />}
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        ) : null}
        {sub}
      </p>
      <span aria-hidden className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-green/50 to-transparent" />
    </div>
  );
}

/** Pipeline from saved lead to interested reply. One hue: it's magnitude. */
export function FunnelBars({ f }: { f: Funnel }) {
  const stages: [string, number, string][] = [
    ["Saved leads", f.leads, "/app/leads"],
    ["Researched", f.researched, "/app/leads"],
    ["Public email found", f.withEmail, "/app/leads"],
    ["Email written", f.drafted, "/app/campaigns"],
    ["Sent", f.sent, "/app/campaigns"],
    ["Replied", f.replied, "/app/inbox"],
    ["Interested", f.interested, "/app/inbox?filter=interested"],
  ];
  const max = Math.max(1, f.leads);
  return (
    <ol className="space-y-2.5">
      {stages.map(([label, n, href], i) => (
        <li key={label}>
          <Link href={href} className="group block">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink group-hover:text-green">{label}</span>
              <span className="tabular-nums text-ink">
                <span className="font-medium">{n}</span>
                {i > 0 ? <span className="ml-2 text-xs text-slate">{pct(n, stages[i - 1][1])} of previous</span> : null}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full" style={{ width: `${Math.max(n ? 2 : 0, (n / max) * 100)}%`, background: "var(--chart-1)", opacity: 1 - i * 0.08 }} />
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function CampaignTable({ rows }: { rows: CampaignStat[] }) {
  if (!rows.length) return <p className="px-5 py-6 text-sm text-slate">Launched campaigns appear here with their results.</p>;
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">Results by campaign</caption>
        <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
          <tr>
            <th scope="col" className="px-5 py-2.5 font-medium">Campaign</th>
            <th scope="col" className="py-2.5 pr-3 text-right font-medium">Sent</th>
            <th scope="col" className="py-2.5 pr-3 text-right font-medium">Replies</th>
            <th scope="col" className="py-2.5 pr-3 text-right font-medium">Reply rate</th>
            <th scope="col" className="py-2.5 pr-3 text-right font-medium">Interested</th>
            <th scope="col" className="py-2.5 pr-5 text-right font-medium">Bounce rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-line last:border-b-0">
              <td className="px-5 py-3">
                <Link href={`/app/campaigns/${c.id}`} className="font-medium text-ink hover:text-green hover:underline">
                  {c.name}
                </Link>
                <span className="block text-xs capitalize text-slate">
                  {c.status} · {c.recipients} recipients
                </span>
              </td>
              <td className="py-3 pr-3 text-right tabular-nums">{c.sent}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{c.replied}</td>
              <td className="py-3 pr-3 text-right font-medium tabular-nums">{pct(c.replied, c.sent)}</td>
              <td className="py-3 pr-3 text-right tabular-nums text-green">{c.interested}</td>
              <td className={cn("py-3 pr-5 text-right tabular-nums", c.sent && c.bounced / c.sent > 0.03 ? "text-danger-fg" : "text-slate")}>{pct(c.bounced, c.sent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const sourceName: Record<string, string> = { google_places: "Google Maps", openstreetmap: "OpenStreetMap", unknown: "Other" };

export function BreakdownList({ rows, kind }: { rows: Breakdown[]; kind: "source" | "niche" }) {
  if (!rows.length) return <p className="text-sm text-slate">Appears once emails have been sent.</p>;
  const max = Math.max(...rows.map((r) => r.sent), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="capitalize text-ink">{kind === "source" ? (sourceName[r.key] ?? r.key) : r.key}</span>
            <span className="text-xs text-slate">
              <span className="font-medium tabular-nums text-ink">{r.sent}</span> sent · <span className="font-medium tabular-nums text-ink">{pct(r.replied, r.sent)}</span> reply rate
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full" style={{ width: `${(r.sent / max) * 100}%`, background: "var(--chart-1)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const activityIcon = { sent: Send, reply: Inbox, unsubscribe: MinusCircle, lead: UserPlus } as const;
const replyLabel: Record<string, string> = { interested: "Interested reply", not_interested: "Not interested", out_of_office: "Out of office", bounce: "Bounced", unclassified: "Reply" };

export function ActivityFeed({ items }: { items: Activity[] }) {
  if (!items.length) return <p className="text-sm text-slate">Searches, sends and replies will show up here.</p>;
  return (
    <ul className="space-y-1">
      {items.map((a, i) => {
        const Icon = activityIcon[a.kind] ?? Mail;
        const verb = a.kind === "sent" ? "Sent" : a.kind === "reply" ? (replyLabel[a.label ?? ""] ?? "Reply") : a.kind === "unsubscribe" ? "Opted out" : "Lead saved";
        const body = (
          <>
            <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", a.kind === "reply" ? "bg-mint-soft text-green" : "bg-canvas text-slate")}>
              <Icon aria-hidden className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{a.title}</span>
              <span className="block truncate text-xs text-slate">
                {verb}
                {a.detail ? ` · ${a.detail}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-[11px] text-slate">{formatDateTime(a.at)}</span>
          </>
        );
        return (
          <li key={`${a.kind}-${i}`}>
            {a.href ? (
              <Link href={a.href} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-canvas">
                {body}
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-2 py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function NavTile({ href, icon: Icon, label, value, sub }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <Link href={href} className="card group flex items-center gap-4 p-4 transition-shadow hover:shadow-float">
      <span className="flex size-11 items-center justify-center rounded-xl bg-mint-soft text-green">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-slate">{label}</span>
        <span className="block font-display text-xl font-semibold tabular-nums text-ink">{value}</span>
        {sub ? <span className="block truncate text-xs text-slate">{sub}</span> : null}
      </span>
      <ArrowRight aria-hidden className="size-4 text-slate transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
