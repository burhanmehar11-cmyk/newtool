"use client";

import Link from "next/link";
import { ArrowRight, CircleCheck, Circle, Inbox, Megaphone, Sparkles, Search } from "lucide-react";
import { useDemo } from "@/demo/store";
import { campaignMetrics, getBiz, usageSummary } from "@/demo/selectors";
import { usageUnitDefinitions } from "@/config/plans";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Callout, EmptyState, Meter, Progress } from "@/components/ui/misc";
import { SampleBadge } from "@/components/product/badges";
import { formatDateTime, formatRate, pluralize } from "@/lib/utils";
import { CampaignStatusBadge } from "@/features/campaigns/status";

export function OverviewView() {
  const s = useDemo();
  const usage = usageSummary(s);
  const p = s.progress;
  const steps = [
    { done: p.searched, label: "Search for sample businesses", href: "/demo/discover", hint: "Try “dental clinics in Austin with a website”." },
    { done: p.inspectedEvidence, label: "Open a lead and inspect its evidence", href: "/demo/leads", hint: "Expand a fact to see its source." },
    { done: p.generatedDraft, label: "Generate a draft from the brief", href: "/demo/leads", hint: "Drafts start from observed facts." },
    { done: p.editedDraft, label: "Edit the draft", href: "/demo/leads", hint: "Every edit creates a new version." },
    { done: p.addedToCampaign, label: "Add the lead to a draft campaign", href: "/demo/campaigns", hint: "Nothing is enrolled automatically." },
    { done: p.simulatedLaunch, label: "Approve and simulate a launch", href: "/demo/campaigns", hint: "No email is sent." },
    { done: p.viewedReply, label: "Open the simulated reply", href: "/demo/inbox", hint: "Follow-ups stop on reply." },
  ];
  const done = steps.filter((x) => x.done).length;
  const qualified = s.threads.filter((t) => t.classification === "interested");
  const active = s.campaigns.filter((c) => c.status !== "cancelled");

  return (
    <div>
      <PageHeader
        title={s.workspace.onboarded ? `Welcome back to ${s.workspace.name}` : "Welcome to the demo"}
        description="Walk through the full workflow with fictional businesses. Everything here stays in this browser."
        actions={
          <Button asChild>
            <Link href="/demo/discover">
              <Search aria-hidden /> New search
            </Link>
          </Button>
        }
      />

      {!s.workspace.onboarded ? (
        <Callout tone="green" icon={<Sparkles />} title="Start by describing what you sell" className="mb-6">
          Research and drafts are matched to your offer.{" "}
          <Link href="/demo/onboarding" className="font-semibold">
            Set up your workspace
          </Link>{" "}
          in about a minute.
        </Callout>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <SectionCard
          title="Guided demo"
          description="Seven steps from search to reply. Each one is simulated."
          actions={<span className="text-sm font-medium tabular-nums text-ink">{done}/7</span>}
        >
          <Progress value={(done / 7) * 100} label="Guided demo progress" className="mb-4" />
          <ol className="space-y-1">
            {steps.map((st, i) => (
              <li key={st.label}>
                <Link href={st.href} className="group flex items-start gap-3 rounded-[10px] px-2 py-2 transition-colors duration-200 hover:bg-canvas">
                  {st.done ? <CircleCheck aria-hidden className="mt-0.5 size-[18px] shrink-0 text-green" /> : <Circle aria-hidden className="mt-0.5 size-[18px] shrink-0 text-line-strong" />}
                  <span className="min-w-0 flex-1">
                    <span className={st.done ? "text-sm text-slate line-through decoration-slate/40" : "text-sm font-medium text-ink"}>
                      {i + 1}. {st.label}
                    </span>
                    {!st.done ? <span className="block text-xs text-slate">{st.hint}</span> : null}
                    <span className="sr-only">{st.done ? " (done)" : " (to do)"}</span>
                  </span>
                  <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0 text-slate opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title="Usage" description="Demo allowance. Units are simulated and nothing is billed.">
          <div className="space-y-4">
            {(
              [
                ["discovery", "Discovery", usageUnitDefinitions.discoveryUnits],
                ["verification", "Verification", usageUnitDefinitions.verificationUnits],
                ["ai", "AI research and drafts", usageUnitDefinitions.aiUnits],
              ] as const
            ).map(([k, label, def]) => (
              <div key={k}>
                <Meter label={label} used={usage[k].used} total={usage[k].allowance} />
                <p className="mt-1 text-xs leading-5 text-slate">
                  {def}
                  {usage[k].reserved ? ` ${usage[k].reserved} currently reserved.` : ""}
                </p>
              </div>
            ))}
          </div>
          <Link href="/demo/settings#usage" className="mt-4 inline-flex text-sm font-medium text-green hover:underline">
            View usage ledger
          </Link>
        </SectionCard>

        <SectionCard title="Campaigns" actions={<Link href="/demo/campaigns" className="text-sm font-medium text-green hover:underline">All campaigns</Link>}>
          {active.length ? (
            <ul className="divide-y divide-line">
              {active.slice(0, 4).map((c) => {
                const m = campaignMetrics(s, c);
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                      <p className="text-xs text-slate">
                        {pluralize(c.leadIds.length, "recipient")} · {m.sent} sent (simulated) · reply rate {formatRate(m.replyRate)}
                      </p>
                    </div>
                    {c.isSample ? <SampleBadge /> : null}
                    <CampaignStatusBadge status={c.status} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<Megaphone />} title="No campaigns yet" action={<Button asChild size="sm" variant="secondary"><Link href="/demo/campaigns">Create a draft campaign</Link></Button>}>
              Campaigns only include leads you add on purpose.
            </EmptyState>
          )}
        </SectionCard>

        <SectionCard title="Qualified replies" description="Replies labelled Interested." actions={<Link href="/demo/inbox" className="text-sm font-medium text-green hover:underline">Inbox</Link>}>
          {qualified.length ? (
            <ul className="divide-y divide-line">
              {qualified.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{getBiz(s, t.leadId)?.name}</p>
                    <p className="text-xs text-slate">{formatDateTime(t.messages[t.messages.length - 1].at)} UTC</p>
                  </div>
                  {t.isSample ? <SampleBadge /> : <Badge tone="info">Simulated</Badge>}
                  {t.unread ? <Badge tone="green">New</Badge> : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Inbox />} title="No interested replies yet">
              They&apos;ll appear here once a (simulated) campaign gets a positive reply.
            </EmptyState>
          )}
        </SectionCard>

        <SectionCard title="Recent work" className="xl:col-span-2">
          {s.activity.length ? (
            <ul className="divide-y divide-line">
              {s.activity.slice(0, 8).map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-36 shrink-0 text-xs tabular-nums text-slate">{formatDateTime(a.at)} UTC</span>
                  {a.href ? (
                    <Link href={a.href} className="text-sm text-ink hover:text-green">
                      {a.text}
                    </Link>
                  ) : (
                    <span className="text-sm text-ink">{a.text}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing yet">Your searches, research and campaigns will be listed here.</EmptyState>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
