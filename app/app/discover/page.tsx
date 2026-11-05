import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Callout, EmptyState } from "@/components/ui/misc";
import { PageLoading } from "@/features/product/page-loading";
import { DiscoverPanel } from "@/features/product/discover-panel";
import { ResultsTable } from "@/features/product/results-table";
import { OsmCredit } from "@/features/product/osm-credit";
import { requireWorkspace } from "@/server/auth";
import { getUsage } from "@/server/services/workspaces";
import { getRecentSearches, getSearch, googleStatus } from "@/server/services/discovery";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Discover" };

export default function DiscoverPage({ searchParams }: PageProps<"/app/discover">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Discover searchParams={searchParams} />
    </Suspense>
  );
}

const statusTone = { completed: "green", failed: "danger", running: "info", queued: "outline", partial: "warn", cancelled: "neutral" } as const;

async function Discover({ searchParams }: { searchParams: PageProps<"/app/discover">["searchParams"] }) {
  const { workspace } = await requireWorkspace("/app/discover");
  const sp = await searchParams;
  const jobId = typeof sp.job === "string" ? sp.job : null;
  const [usage, recent, search, google] = await Promise.all([getUsage(workspace), getRecentSearches(), jobId ? getSearch(jobId) : Promise.resolve(null), googleStatus()]);
  const discovery = usage.find((u) => u.kind === "discovery")!;
  const available = Math.max(0, discovery.allowance - discovery.used - discovery.reserved);

  return (
    <div>
      <PageHeader title="Discover" description="Find local businesses on Google Maps or OpenStreetMap, then save the ones worth researching. Nothing is contacted from here." />
      <DiscoverPanel
        available={available}
        google={google}
        prefill={{
          niche: typeof sp.niche === "string" ? sp.niche.slice(0, 40) : undefined,
          place: typeof sp.place === "string" ? sp.place.slice(0, 100) : undefined,
          runId: typeof sp.run === "string" && /^[0-9a-z]{1,20}$/i.test(sp.run) ? sp.run : undefined,
        }}
        recent={
        <SectionCard title="Recent searches" bodyClassName="p-0">
          {recent.length ? (
            <ul className="divide-y divide-line">
              {recent.map((j) => (
                <li key={j.id}>
                  <Link href={`/app/discover?job=${j.id}`} className="block px-5 py-3 hover:bg-canvas" aria-current={j.id === jobId ? "page" : undefined}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">{j.query}</span>
                      <Badge tone={statusTone[j.status as keyof typeof statusTone] ?? "outline"}>{j.status}</Badge>
                    </span>
                    <span className="text-xs text-slate">
                      {j.provider === "google_places" ? "Google Maps" : "OpenStreetMap"} · {formatDateTime(j.created_at)} UTC · {j.charged_units} found
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-slate">Your searches will be listed here.</p>
          )}
        </SectionCard>
        }
      />

      {jobId ? (
        <SectionCard
          className="mt-5"
          title={search ? search.job.query : "Search not found"}
          description={
            search
              ? search.job.provider === "google_places" && search.job.status === "completed"
                ? `Google Maps · ${search.job.charged_units} businesses found · charged ${search.job.charged_units} of ${search.job.estimated_units} reserved units`
                : search.job.status === "completed"
                ? `${search.results.length} businesses · charged ${search.job.charged_units} of ${search.job.estimated_units} reserved units`
                : search.job.status === "failed"
                  ? "Nothing was charged for this search."
                  : "Running…"
              : undefined
          }
          bodyClassName="p-0"
        >
          {!search ? (
            <div className="p-5">
              <EmptyState title="This search isn't in your workspace">It may belong to another workspace, or the link is wrong.</EmptyState>
            </div>
          ) : search.job.provider === "google_places" && search.job.status !== "failed" ? (
            <div className="p-5">
              <Callout tone="info" title="Google Maps results aren't stored">
                Google&apos;s terms don&apos;t allow keeping Places results, so this search shows only its summary. Run it again to see the businesses; leads you saved are in Leads.
              </Callout>
            </div>
          ) : search.job.status === "failed" ? (
            <div className="p-5">
              <Callout tone="danger" title="The search didn't complete">
                {search.job.error ?? "Unknown error."} The reserved units were released.
              </Callout>
            </div>
          ) : search.results.length ? (
            <>
              <ResultsTable rows={search.results} />
              <div className="border-t border-line px-5 py-3">
                <OsmCredit />
              </div>
            </>
          ) : (
            <div className="p-5">
              <EmptyState icon={<Search />} title="No businesses found">
                OpenStreetMap has no matching listings in that area. Try a larger radius or a nearby city.
              </EmptyState>
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
