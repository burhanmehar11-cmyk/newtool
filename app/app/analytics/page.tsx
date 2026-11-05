import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Ban, FileSearch, Inbox, Info, Mail, MapPinned, Send, Sparkles, Users } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { PageLoading } from "@/features/product/page-loading";
import { BreakdownList, CampaignTable, FunnelBars, Kpi, pct } from "@/features/analytics/parts";
import { AreaTable, LeadFunnelBars, NicheTable, OpportunityList, QualityCard } from "@/features/analytics/lead-parts";
import { TrendChart } from "@/features/analytics/trend-chart";
import { getAnalytics, getLeadAnalytics } from "@/server/services/analytics";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage({ searchParams }: PageProps<"/app/analytics">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Analytics searchParams={searchParams} />
    </Suspense>
  );
}

async function Analytics({ searchParams }: { searchParams: PageProps<"/app/analytics">["searchParams"] }) {
  const sp = await searchParams;
  const tab = sp.tab === "outreach" ? "outreach" : "leads";
  const range = typeof sp.range === "string" && ["7", "30", "90"].includes(sp.range) ? sp.range : "30";
  const href = (t: string, r: string) => `/app/analytics?tab=${t}&range=${r}`;
  return (
    <div>
      <PageHeader
        title="Analytics"
        description={tab === "leads" ? "How your searches turn into qualified leads: what you found, what you kept, and what their websites need." : "How your emails perform, from sent to interested reply."}
        actions={
          <nav aria-label="Time range" className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
            {["7", "30", "90"].map((r) => (
              <Link key={r} href={href(tab, r)} aria-current={range === r ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 font-medium", range === r ? "bg-ink text-white" : "text-slate hover:text-ink")}>
                {r} days
              </Link>
            ))}
          </nav>
        }
      />
      <nav aria-label="Analytics sections" className="mb-5 flex gap-1 border-b border-line">
        {[
          ["leads", "Leads", MapPinned],
          ["outreach", "Outreach", Send],
        ].map(([t, label, Icon]) => {
          const I = Icon as typeof Send;
          return (
            <Link
              key={t as string}
              href={href(t as string, range)}
              aria-current={tab === t ? "page" : undefined}
              className={cn("-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium", tab === t ? "border-green text-ink" : "border-transparent text-slate hover:text-ink")}
            >
              <I aria-hidden className="size-4" /> {label as string}
            </Link>
          );
        })}
      </nav>
      {tab === "leads" ? <LeadsTab range={range} /> : <OutreachTab range={range} />}
    </div>
  );
}

async function LeadsTab({ range }: { range: string }) {
  const a = await getLeadAnalytics(range);
  const c = a.current;
  const p = a.previous;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={MapPinned} label="Businesses found" value={String(c.found)} delta={c.found - p.found} sub={`${c.searches} searches · vs previous ${a.days} days`} />
        <Kpi icon={Users} label="Saved as leads" value={String(c.saved)} delta={c.saved - p.saved} sub={c.found ? `${pct(c.saved, c.found)} save rate` : "from your searches"} />
        <Kpi icon={FileSearch} label="Websites researched" value={String(c.researched)} delta={c.researched - p.researched} sub="with an Opportunity Brief" />
        <Kpi icon={Mail} label="Public emails found" value={String(c.emails)} delta={c.emails - p.emails} sub="from businesses' own sites" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <SectionCard title="Found and saved" description={`Per day, last ${a.days} days (UTC)`}>
          <TrendChart
            data={a.series}
            series={[
              { key: "found", label: "Found", color: "var(--chart-1)" },
              { key: "saved", label: "Saved", color: "var(--chart-2)" },
            ]}
          />
        </SectionCard>
        <SectionCard title="Lead pipeline" description="All time, from search result to reply">
          <LeadFunnelBars f={a.funnel} />
        </SectionCard>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Top opportunities" description="What researched websites are missing">
          <OpportunityList data={a.opportunities} />
        </SectionCard>
        <SectionCard title="Lead quality" description="All saved leads">
          <QualityCard q={a.quality} />
        </SectionCard>
        <SectionCard title="Top search areas" description="Where you've found the most businesses">
          <AreaTable rows={a.areas} />
        </SectionCard>
      </div>
      <SectionCard title="By business type" description="Which kinds of businesses make the best leads" bodyClassName="p-0">
        <NicheTable rows={a.niches} />
      </SectionCard>
      <p className="flex items-start gap-2 text-xs leading-5 text-slate">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Google Maps results aren&apos;t stored (Google&apos;s terms), so &ldquo;found&rdquo; counts results returned by your searches. Opportunities count only what a business&apos;s own website showed; anything not seen stays unknown.
      </p>
    </div>
  );
}

async function OutreachTab({ range }: { range: string }) {
  const a = await getAnalytics(range);
  const c = a.current;
  const p = a.previous;
  const replyRate = c.sent ? Math.round((c.replied / c.sent) * 1000) / 10 : null;
  const prevRate = p.sent ? Math.round((p.replied / p.sent) * 1000) / 10 : null;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Send} label="Emails sent" value={String(c.sent)} delta={c.sent - p.sent} sub={`vs previous ${a.days} days`} />
        <Kpi icon={Inbox} label="Reply rate" value={replyRate === null ? "–" : `${replyRate}%`} delta={replyRate !== null && prevRate !== null ? Math.round((replyRate - prevRate) * 10) / 10 : null} sub={`${c.replied} conversations replied`} />
        <Kpi icon={Sparkles} label="Interested" value={String(c.interested)} delta={c.interested - p.interested} sub={c.replied ? `${pct(c.interested, c.replied)} of replies` : "labelled replies"} />
        <Kpi icon={Ban} label="Bounce rate" value={c.sent ? pct(c.bounced, c.sent) : "–"} invert delta={c.bounced - p.bounced} sub={`${c.unsubscribed} unsubscribed · ${c.outOfOffice} out of office`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <SectionCard title="Sent and replies" description={`Per day, last ${a.days} days (UTC)`}>
          <TrendChart data={a.series} />
        </SectionCard>
        <SectionCard title="Outreach pipeline" description="All time, counted in leads">
          <FunnelBars f={a.funnel} />
        </SectionCard>
      </div>
      <SectionCard title="By campaign" description="Launched campaigns, all time" bodyClassName="p-0">
        <CampaignTable rows={a.campaigns} />
      </SectionCard>
      <div className="grid gap-5 md:grid-cols-2">
        <SectionCard title="By lead source" description="Where the businesses you emailed came from">
          <BreakdownList rows={a.bySource} kind="source" />
        </SectionCard>
        <SectionCard title="By business type" description="Which kinds of businesses reply">
          <BreakdownList rows={a.byNiche} kind="niche" />
        </SectionCard>
      </div>
      <p className="flex items-start gap-2 text-xs leading-5 text-slate">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Opens aren&apos;t tracked: Locenti adds no tracking pixels, which mail apps often block or flag. Replies need reply tracking turned on for the mailbox; labels are suggestions you can change in the Inbox.
      </p>
    </div>
  );
}
