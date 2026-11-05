import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CircleCheck, Circle, FileSearch, Inbox, Mail, MapPinned, Search, Send, Sparkles, Users } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/features/product/page-loading";
import { Kpi, pct } from "@/features/analytics/parts";
import { NicheTable, OpportunityList, QualityCard, QuickSearch, SearchList } from "@/features/analytics/lead-parts";
import { TrendChart } from "@/features/analytics/trend-chart";
import { requireWorkspace } from "@/server/auth";
import { getAnalytics, getLeadAnalytics } from "@/server/services/analytics";
import { getOfferProfile } from "@/server/services/workspaces";
import { googlePlacesConfigured, remainingToday } from "@/server/providers/google-places";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const { workspace } = await requireWorkspace("/app");
  const googleReady = googlePlacesConfigured();
  const [offer, l, o, googleLeft] = await Promise.all([getOfferProfile(workspace), getLeadAnalytics("30", "/app"), getAnalytics("30", "/app"), googleReady ? remainingToday().catch(() => null) : Promise.resolve(null)]);
  const c = l.current;
  const p = l.previous;

  const setup = [
    { done: !!offer, label: "Tell Locentio what you sell", href: "/app/settings" },
    { done: l.funnel.found > 0, label: "Run your first map search", href: "/app/discover" },
    { done: l.funnel.saved > 0, label: "Save businesses as leads", href: "/app/discover" },
    { done: l.funnel.researched > 0, label: "Research a lead's website", href: "/app/leads" },
    { done: o.today.connected > 0, label: "Connect Gmail (for outreach)", href: "/app/mailboxes" },
    { done: o.campaigns.length > 0, label: "Send your first campaign", href: "/app/campaigns/new" },
  ];
  const doneCount = setup.filter((s) => s.done).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={`Your lead pipeline for ${workspace.name}, last 30 days.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/app/analytics">Analytics</Link>
            </Button>
            <Button asChild>
              <Link href="/app/discover">
                <Search aria-hidden /> Find businesses
              </Link>
            </Button>
          </div>
        }
      />

      <QuickSearch googleReady={googleReady} googleLeft={googleLeft} />

      {doneCount < setup.length ? (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden className="size-4 text-green" />
              <h2 className="font-display text-base font-semibold text-ink">Getting started</h2>
              <span className="text-xs text-slate">
                {doneCount} of {setup.length}
              </span>
            </div>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full bg-green" style={{ width: `${(doneCount / setup.length) * 100}%` }} />
            </div>
          </div>
          <ol className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {setup.map((s) => (
              <li key={s.label} className="bg-surface">
                <Link href={s.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-canvas">
                  {s.done ? <CircleCheck aria-hidden className="size-[18px] shrink-0 text-green" /> : <Circle aria-hidden className="size-[18px] shrink-0 text-line-strong" />}
                  <span className={s.done ? "text-slate line-through" : "font-medium text-ink"}>{s.label}</span>
                  {!s.done ? <ArrowRight aria-hidden className="ml-auto size-4 text-slate" /> : null}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={MapPinned} label="Businesses found" value={String(c.found)} delta={c.found - p.found} sub={`${c.searches} search${c.searches === 1 ? "" : "es"}`} />
        <Kpi icon={Users} label="Leads saved" value={String(c.saved)} delta={c.saved - p.saved} sub={c.found ? `${pct(c.saved, c.found)} of found` : "vs previous 30 days"} />
        <Kpi icon={FileSearch} label="Websites researched" value={String(c.researched)} delta={c.researched - p.researched} sub="Opportunity Briefs" />
        <Kpi icon={Mail} label="Emails found" value={String(c.emails)} delta={c.emails - p.emails} sub="public, from websites" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <SectionCard title="Discovery" description="Businesses found and leads saved per day, last 30 days" actions={<Link href="/app/analytics" className="text-sm font-medium">Details</Link>}>
          <TrendChart
            data={l.series}
            series={[
              { key: "found", label: "Found", color: "var(--chart-1)" },
              { key: "saved", label: "Saved", color: "var(--chart-2)" },
            ]}
          />
        </SectionCard>
        <SectionCard title="Top opportunities" description="What your leads' websites are missing">
          <OpportunityList data={l.opportunities} />
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <SectionCard title="Lead quality" description="All saved leads">
          <QualityCard q={l.quality} />
        </SectionCard>
        <SectionCard title="Recent searches" actions={<Link href="/app/discover" className="text-sm font-medium">New search</Link>}>
          <SearchList rows={l.searches} />
        </SectionCard>
        <SectionCard title="Outreach" description="Last 30 days" actions={<Link href="/app/analytics?tab=outreach" className="text-sm font-medium">Details</Link>}>
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[
              [Send, "Sent", o.current.sent],
              [Inbox, "Replies", o.current.replied],
              [Sparkles, "Interested", o.current.interested],
            ].map(([Icon, label, n]) => {
              const I = Icon as typeof Send;
              return (
                <div key={label as string} className="rounded-xl border border-line p-3">
                  <I aria-hidden className="mx-auto size-4 text-slate" />
                  <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">{n as number}</dd>
                  <dt className="text-xs text-slate">{label as string}</dt>
                </div>
              );
            })}
          </dl>
          <p className="mt-4 text-sm text-slate">
            {o.current.sent ? `${pct(o.current.replied, o.current.sent)} reply rate.` : "Turn researched leads into personal emails."}{" "}
            <Link href={o.campaigns.length ? "/app/campaigns" : "/app/campaigns/new"}>{o.campaigns.length ? "View campaigns" : "Start a campaign"}</Link>
          </p>
        </SectionCard>
      </div>

      <SectionCard title="Leads by business type" bodyClassName="p-0" actions={<Link href="/app/leads" className="text-sm font-medium">All leads</Link>}>
        <NicheTable rows={l.niches} />
      </SectionCard>
    </div>
  );
}
