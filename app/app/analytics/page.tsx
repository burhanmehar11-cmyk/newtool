import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Ban, Inbox, Info, Send, Sparkles } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { PageLoading } from "@/features/product/page-loading";
import { BreakdownList, CampaignTable, FunnelBars, Kpi, pct } from "@/features/analytics/parts";
import { TrendChart } from "@/features/analytics/trend-chart";
import { getAnalytics } from "@/server/services/analytics";
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
  const a = await getAnalytics(typeof sp.range === "string" ? sp.range : "30");
  const c = a.current;
  const p = a.previous;
  const replyRate = c.sent ? Math.round((c.replied / c.sent) * 1000) / 10 : null;
  const prevRate = p.sent ? Math.round((p.replied / p.sent) * 1000) / 10 : null;
  return (
    <div>
      <PageHeader
        title="Analytics"
        description="How your outreach is doing, from saved lead to interested reply. Every number comes from your own sends and replies."
        actions={
          <nav aria-label="Time range" className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
            {(["7", "30", "90"] as const).map((r) => (
              <Link key={r} href={`/app/analytics?range=${r}`} aria-current={String(a.days) === r ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 font-medium", String(a.days) === r ? "bg-ink text-white" : "text-slate hover:text-ink")}>
                {r} days
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Send} label="Emails sent" value={String(c.sent)} delta={c.sent - p.sent} sub={`vs previous ${a.days} days`} />
        <Kpi icon={Inbox} label="Reply rate" value={replyRate === null ? "–" : `${replyRate}%`} delta={replyRate !== null && prevRate !== null ? Math.round((replyRate - prevRate) * 10) / 10 : null} sub={`${c.replied} conversations replied`} />
        <Kpi icon={Sparkles} label="Interested" value={String(c.interested)} delta={c.interested - p.interested} sub={c.replied ? `${pct(c.interested, c.replied)} of replies` : "labelled replies"} />
        <Kpi icon={Ban} label="Bounce rate" value={c.sent ? pct(c.bounced, c.sent) : "–"} invert delta={c.bounced - p.bounced} sub={`${c.unsubscribed} unsubscribed · ${c.outOfOffice} out of office`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <SectionCard title="Sent and replies" description={`Per day, last ${a.days} days (UTC)`}>
          <TrendChart data={a.series} />
        </SectionCard>
        <SectionCard title="Pipeline" description="All time, counted in leads">
          <FunnelBars f={a.funnel} />
        </SectionCard>
      </div>

      <SectionCard className="mt-5" title="By campaign" description="Launched campaigns, all time" bodyClassName="p-0">
        <CampaignTable rows={a.campaigns} />
      </SectionCard>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <SectionCard title="By lead source" description="Where the businesses you emailed came from">
          <BreakdownList rows={a.bySource} kind="source" />
        </SectionCard>
        <SectionCard title="By business type" description="Which kinds of businesses reply">
          <BreakdownList rows={a.byNiche} kind="niche" />
        </SectionCard>
      </div>

      <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Opens aren&apos;t tracked: Locentio adds no tracking pixels, which mail apps often block or flag. Replies need reply tracking turned on for the mailbox; labels are suggestions you can change in the Inbox.
      </p>
    </div>
  );
}
