import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck, Circle, FlaskConical } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Callout, Meter } from "@/components/ui/misc";
import { PageLoading } from "@/features/product/page-loading";
import { usageUnitDefinitions } from "@/config/plans";
import { requireWorkspace } from "@/server/auth";
import { getOfferProfile, getUsage } from "@/server/services/workspaces";
import { getLeads, getRecentSearches } from "@/server/services/discovery";

export const metadata: Metadata = { title: "Overview" };

export default function ProductOverviewPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Overview />
    </Suspense>
  );
}

const usageLabels = {
  discovery: ["Discovery", usageUnitDefinitions.discoveryUnits],
  verification: ["Verification", usageUnitDefinitions.verificationUnits],
  ai: ["AI research and drafts", usageUnitDefinitions.aiUnits],
} as const;

async function Overview() {
  const { user, workspace } = await requireWorkspace("/app");
  const [offer, usage, recent, leads] = await Promise.all([getOfferProfile(workspace), getUsage(workspace), getRecentSearches(), getLeads()]);
  const searches = recent.length;
  const leadCount = leads.length;

  const steps = [
    { done: true, label: "Account created", detail: user.email ?? "" },
    { done: true, label: "Workspace created", detail: workspace.name },
    { done: !!offer, label: "Offer profile", detail: offer ? offer.service : "Tell us what you sell", href: "/app/settings" },
    { done: searches > 0, label: "Search for businesses", detail: searches > 0 ? `${searches}${searches >= 8 ? "+" : ""} search${searches === 1 ? "" : "es"} so far` : "Free OpenStreetMap search", href: "/app/discover" },
    { done: leadCount > 0, label: "Save leads", detail: leadCount > 0 ? `${leadCount} saved` : "Choose which results to keep", href: "/app/leads" },
    { done: false, label: "Verify contacts and research leads", detail: "Planned for the private beta" },
    { done: false, label: "Connect Gmail and send an approved sequence", detail: "Planned for the private beta" },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome to ${workspace.name}`}
        description="Your private-beta workspace. Search and leads are live; research and sending are added step by step."
        actions={
          <Button asChild variant="secondary">
            <Link href="/demo">
              <FlaskConical aria-hidden /> Open the demo
            </Link>
          </Button>
        }
      />
      {!offer ? (
        <Callout tone="warn" className="mb-6" title="Finish your offer profile">
          Research and drafts are scored against what you sell. <Link href="/app/settings">Add it in Settings</Link>.
        </Callout>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <SectionCard title="Getting started" description="What's live in your workspace today.">
          <ol className="space-y-1">
            {steps.map((s) => {
              const body = (
                <>
                  {s.done ? <CircleCheck aria-hidden className="mt-0.5 size-[18px] shrink-0 text-green" /> : <Circle aria-hidden className="mt-0.5 size-[18px] shrink-0 text-line-strong" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{s.label}</span>
                    <span className="block truncate text-xs text-slate">{s.detail}</span>
                  </span>
                  <span className="sr-only">{s.done ? "(done)" : "(not yet)"}</span>
                </>
              );
              return (
                <li key={s.label}>
                  {s.href && !s.done ? (
                    <Link href={s.href} className="flex items-start gap-3 rounded-[10px] px-2 py-2 hover:bg-canvas">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 px-2 py-2">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </SectionCard>
        <SectionCard title="Usage" description="Beta allowance for this workspace. Nothing is billed during the beta.">
          <div className="space-y-4">
            {usage.map((u) => (
              <div key={u.kind}>
                <Meter label={usageLabels[u.kind][0]} used={u.used} total={u.allowance} />
                <p className="mt-1 text-xs leading-5 text-slate">
                  {usageLabels[u.kind][1]}
                  {u.reserved ? ` ${u.reserved} reserved for running work.` : ""}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Badge tone="outline">Role: {workspace.role}</Badge>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
