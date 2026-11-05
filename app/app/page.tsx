import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Ban, Bot, CircleCheck, Circle, Inbox, Mail, MapPinned, Plus, Send, Sparkles, Users } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/misc";
import { PageLoading } from "@/features/product/page-loading";
import { ActivityFeed, Kpi, NavTile, pct } from "@/features/analytics/parts";
import { TrendChart } from "@/features/analytics/trend-chart";
import { requireWorkspace } from "@/server/auth";
import { getAnalytics } from "@/server/services/analytics";
import { aiWriterStatus } from "@/server/services/ai-writer";
import { getOfferProfile, getUsage } from "@/server/services/workspaces";
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
  const [offer, usage, a, googleLeft] = await Promise.all([getOfferProfile(workspace), getUsage(workspace), getAnalytics("30", "/app"), googlePlacesConfigured() ? remainingToday().catch(() => null) : Promise.resolve(null)]);
  const c = a.current;
  const p = a.previous;
  const ai = aiWriterStatus();
  const unit = (k: string) => usage.find((u) => u.kind === k);
  const running = a.campaigns.filter((x) => x.status === "running" || x.status === "paused");

  const setup = [
    { done: !!offer, label: "Tell Locentio what you sell", href: "/app/settings" },
    { done: a.funnel.leads > 0, label: "Find and save businesses", href: "/app/discover" },
    { done: a.funnel.researched > 0, label: "Research a lead's website", href: "/app/leads" },
    { done: a.today.connected > 0, label: "Connect your Gmail", href: "/app/mailboxes" },
    { done: a.today.replyTracking > 0, label: "Turn on reply tracking", href: "/app/mailboxes" },
    { done: a.campaigns.length > 0, label: "Launch your first campaign", href: "/app/campaigns/new" },
  ];
  const doneCount = setup.filter((s) => s.done).length;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back. Here's ${workspace.name} over the last 30 days.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/app/analytics">Full analytics</Link>
            </Button>
            <Button asChild>
              <Link href="/app/campaigns/new">
                <Plus aria-hidden /> New campaign
              </Link>
            </Button>
          </div>
        }
      />

      {doneCount < setup.length ? (
        <section className="card mb-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-mint-soft/70 to-transparent px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-surface text-green shadow-sm">
                <Sparkles aria-hidden className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Finish setting up</h2>
                <p className="text-xs text-slate">
                  {doneCount} of {setup.length} done
                </p>
              </div>
            </div>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-green" style={{ width: `${(doneCount / setup.length) * 100}%` }} />
            </div>
          </div>
          <ol className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {setup.map((s) => (
              <li key={s.label} className="bg-surface">
                <Link href={s.href} className="flex items-center gap-3 px-5 py-3.5 text-sm hover:bg-canvas">
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
        <Kpi icon={Send} label="Emails sent" value={String(c.sent)} delta={c.sent - p.sent} sub="vs previous 30 days" />
        <Kpi icon={Inbox} label="Reply rate" value={c.sent ? pct(c.replied, c.sent) : "–"} sub={`${c.replied} replied`} />
        <Kpi icon={Sparkles} label="Interested" value={String(c.interested)} delta={c.interested - p.interested} sub="positive replies" />
        <Kpi icon={Ban} label="Bounce rate" value={c.sent ? pct(c.bounced, c.sent) : "–"} invert sub={`${c.unsubscribed} unsubscribed`} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <NavTile href="/app/leads" icon={Users} label="Leads" value={String(a.funnel.leads)} sub={`${a.funnel.researched} researched`} />
        <NavTile href="/app/mailboxes" icon={Mail} label="Mailboxes" value={`${a.today.connected}`} sub={a.today.connected ? `${a.today.sentToday} of ${a.today.capToday} sent today` : "Connect Gmail to send"} />
        <NavTile href="/app/campaigns" icon={Send} label="Active campaigns" value={String(running.length)} sub={running.length ? `${running.reduce((n, x) => n + x.sent, 0)} sent so far` : "None running"} />
        <NavTile href="/app/agent" icon={Bot} label="AI writing" value={ai.configured ? "Ready" : "Agent"} sub={ai.configured ? `${unit("ai") ? unit("ai")!.allowance - unit("ai")!.used : 0} AI emails left` : "Built-in writer not set up"} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <SectionCard title="Email performance" description="Sent and replies per day, last 30 days" actions={<Link href="/app/analytics" className="text-sm font-medium">Details</Link>}>
          <TrendChart data={a.series} />
        </SectionCard>
        <SectionCard title="Recent activity">
          <ActivityFeed items={a.activity.slice(0, 8)} />
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <SectionCard title="Active campaigns" actions={<Link href="/app/campaigns" className="text-sm font-medium">All campaigns</Link>}>
          {running.length ? (
            <ul className="space-y-4">
              {running.map((x) => (
                <li key={x.id}>
                  <Link href={`/app/campaigns/${x.id}`} className="group flex items-center gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-green">
                      <Send aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-medium text-ink group-hover:text-green">{x.name}</span>
                        <span className="shrink-0 text-xs text-slate">
                          {x.sent}/{x.recipients} sent · {x.replied} replies{x.status === "paused" ? " · paused" : ""}
                        </span>
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-canvas">
                        <span className="block h-full rounded-full bg-green" style={{ width: `${x.recipients ? (x.sent / x.recipients) * 100 : 0}%` }} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-3 text-sm text-slate">
              No campaign is running. Pick researched leads, review each email and approve.
              <Button asChild size="sm">
                <Link href="/app/campaigns/new">
                  <Plus aria-hidden /> New campaign
                </Link>
              </Button>
            </div>
          )}
        </SectionCard>
        <SectionCard title="Usage" description="Beta allowance. Nothing is billed during the beta.">
          <div className="space-y-4">
            {(["discovery", "ai"] as const).map((k) => {
              const u = unit(k);
              return u ? <Meter key={k} label={k === "discovery" ? "Discovery units" : "AI emails"} used={u.used} total={u.allowance} /> : null;
            })}
            {googlePlacesConfigured() ? (
              <p className="flex items-center gap-2 text-sm text-slate">
                <MapPinned aria-hidden className="size-4 text-green" /> <span className="font-medium tabular-nums text-ink">{googleLeft ?? "–"}</span> Google Maps searches left today
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
