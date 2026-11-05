import Link from "next/link";
import { MapPinned } from "lucide-react";
import { QuickSearchForm } from "./quick-search-form";
import { nicheLabel } from "@/lib/discovery/niches";
import type { AreaRow, LeadFunnel, LeadQuality, NicheRow, Opportunity, SearchRow } from "@/server/analytics-store";
import { pct } from "./parts";
import { cn, formatDateTime } from "@/lib/utils";

/** Google Maps search straight from the dashboard; opens Discover with the fields filled in and runs it. */
export function QuickSearch({ googleLeft, googleReady }: { googleLeft: number | null; googleReady: boolean }) {
  return (
    <section className="on-dark relative overflow-hidden rounded-2xl bg-midnight p-6 text-white sm:p-8">
      <div aria-hidden className="hero-aurora pointer-events-none absolute -inset-[20%] opacity-70" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mint">
              <MapPinned aria-hidden className="size-3.5" /> {googleReady ? "Google Maps" : "Map search"}
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Find local businesses to pitch</h2>
            <p className="mt-1 text-sm text-white/65">Search by business type and area. Locenti finds their websites, public emails and what they could improve.</p>
          </div>
          {googleReady && googleLeft !== null ? <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-xs text-white/75">{googleLeft} Google searches left today</span> : null}
        </div>
        <QuickSearchForm />
      </div>
    </section>
  );
}

/** Where research found something to fix: the agency's talking points. */
export function OpportunityList({ data }: { data: { researched: number; items: Opportunity[] } }) {
  if (!data.researched) return <p className="text-sm text-slate">Research a few leads and this shows what their websites are missing, like online booking or a mobile layout.</p>;
  const max = Math.max(1, ...data.items.map((i) => i.count));
  return (
    <div>
      <p className="mb-3 text-xs text-slate">Across {data.researched} researched lead{data.researched === 1 ? "" : "s"}. Only what their own websites showed.</p>
      <ul className="space-y-3">
        {data.items.map((o) => (
          <li key={o.key}>
            <Link href="/app/leads" className="group block">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-ink group-hover:text-green">{o.label}</span>
                <span className="text-sm tabular-nums text-ink">
                  <span className="font-semibold">{o.count}</span> <span className="text-xs text-slate">{pct(o.count, data.researched)}</span>
                </span>
              </div>
              <p className="text-xs text-slate">{o.detail}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
                <div className="h-full rounded-full" style={{ width: `${(o.count / max) * 100}%`, background: "var(--chart-1)" }} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function QualityCard({ q }: { q: LeadQuality }) {
  const seg = [
    { label: "Strong fit", n: q.strong, cls: "bg-green" },
    { label: "Moderate", n: q.moderate, cls: "bg-green/60" },
    { label: "Weak", n: q.weak, cls: "bg-green/30" },
    { label: "Not researched", n: q.notResearched, cls: "bg-line" },
  ];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate">Fit for your offer</p>
        <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full bg-canvas" role="img" aria-label={seg.map((s) => `${s.label}: ${s.n}`).join(", ")}>
          {q.total ? seg.filter((s) => s.n).map((s) => <span key={s.label} className={s.cls} style={{ width: `${(s.n / q.total) * 100}%` }} />) : null}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {seg.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-sm", s.cls)} />
              <span className="text-slate">{s.label}</span>
              <span className="ml-auto font-medium tabular-nums text-ink">{s.n}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line p-3">
          <p className="text-xs text-slate">Public email found</p>
          <p className="font-display text-2xl font-semibold tabular-nums text-ink">{pct(q.withEmail, q.total)}</p>
          <p className="text-xs text-slate">
            {q.withEmail} of {q.total}
          </p>
        </div>
        <div className="rounded-xl border border-line p-3">
          <p className="text-xs text-slate">Has a website</p>
          <p className="font-display text-2xl font-semibold tabular-nums text-ink">{pct(q.withWebsite, q.total)}</p>
          <p className="text-xs text-slate">
            {q.withWebsite} of {q.total}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SearchList({ rows }: { rows: SearchRow[] }) {
  if (!rows.length)
    return (
      <p className="text-sm text-slate">
        No searches yet. <Link href="/app/discover">Run your first search</Link>.
      </p>
    );
  return (
    <ul className="divide-y divide-line">
      {rows.map((s) => (
        <li key={s.id}>
          <Link href={`/app/discover?job=${s.id}`} className="flex items-center gap-3 py-2.5 hover:text-green">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-slate">
              <MapPinned aria-hidden className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{s.query}</span>
              <span className="block text-xs text-slate">
                {s.provider === "google_places" ? "Google Maps" : "OpenStreetMap"} · {formatDateTime(s.created_at)}
              </span>
            </span>
            <span className="shrink-0 text-right text-sm tabular-nums text-ink">
              {s.status === "failed" ? <span className="text-xs text-danger-fg">failed</span> : <>{s.found} <span className="text-xs text-slate">found</span></>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function NicheTable({ rows }: { rows: NicheRow[] }) {
  if (!rows.length) return <p className="px-5 py-6 text-sm text-slate">Save leads to see which business types you&apos;re building.</p>;
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Leads by business type</caption>
        <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
          <tr>
            <th scope="col" className="px-5 py-2.5 font-medium">Business type</th>
            <th scope="col" className="py-2.5 pr-3 text-right font-medium">Leads</th>
            <th scope="col" className="py-2.5 pr-3 text-right font-medium">Researched</th>
            <th scope="col" className="py-2.5 pr-3 text-right font-medium">With email</th>
            <th scope="col" className="py-2.5 pr-3 text-right font-medium">Strong fit</th>
            <th scope="col" className="py-2.5 pr-5 text-right font-medium">Replied</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.niche} className="border-b border-line last:border-b-0">
              <td className="px-5 py-2.5 font-medium text-ink">{r.niche === "other" ? "Other" : nicheLabel(r.niche)}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{r.leads}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{pct(r.researched, r.leads)}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{pct(r.withEmail, r.leads)}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-green">{r.strong}</td>
              <td className="py-2.5 pr-5 text-right tabular-nums">{r.contacted ? `${r.replied} of ${r.contacted}` : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AreaTable({ rows }: { rows: AreaRow[] }) {
  if (!rows.length) return <p className="text-sm text-slate">Areas you search appear here.</p>;
  const max = Math.max(1, ...rows.map((r) => r.found));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.place}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink">{r.place}</span>
            <span className="shrink-0 text-xs text-slate">
              <span className="font-medium tabular-nums text-ink">{r.found}</span> found · {r.searches} search{r.searches === 1 ? "" : "es"}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full" style={{ width: `${(r.found / max) * 100}%`, background: "var(--chart-1)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LeadFunnelBars({ f }: { f: LeadFunnel }) {
  const stages: [string, number][] = [
    ["Businesses found", f.found],
    ["Saved as leads", f.saved],
    ["Website researched", f.researched],
    ["Public email found", f.withEmail],
    ["Strong fit", f.strongFit],
    ["Contacted", f.contacted],
    ["Replied", f.replied],
  ];
  const max = Math.max(1, f.found, f.saved);
  return (
    <ol className="space-y-2.5">
      {stages.map(([label, n], i) => (
        <li key={label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink">{label}</span>
            <span className="tabular-nums text-ink">
              <span className="font-medium">{n}</span>
              {i === 1 ? <span className="ml-2 text-xs text-slate">{pct(n, f.found)} of found</span> : i > 1 ? <span className="ml-2 text-xs text-slate">{pct(n, f.saved)} of saved</span> : null}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full" style={{ width: `${Math.max(n ? 2 : 0, (n / max) * 100)}%`, background: i < 5 ? "var(--chart-1)" : "var(--chart-2)" }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
