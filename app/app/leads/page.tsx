import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink, Search, Users } from "lucide-react";
import { PageHero, StepGuide } from "@/components/app/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { EmailStatusBadge, NoEmailBadge } from "@/components/product/badges";
import { PageLoading } from "@/features/product/page-loading";
import { OsmCredit } from "@/features/product/osm-credit";
import { FindEmailsButton } from "@/features/product/lead-actions";
import { googleMapsLink } from "@/lib/discovery/google-places";
import { nicheLabel } from "@/lib/discovery/niches";
import { getLeads } from "@/server/services/discovery";
import type { EmailStatus } from "@/lib/domain/types";
import type { LeadRow } from "@/server/discovery-store";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Leads" };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unresearched", label: "Not researched" },
  { id: "email", label: "Has email" },
  { id: "noemail", label: "No email" },
  { id: "strong", label: "Strong fit" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const keep = (f: FilterId, l: LeadRow) =>
  f === "unresearched" ? !l.researched_at : f === "email" ? !!l.email : f === "noemail" ? !l.email : f === "strong" ? l.fit === "strong" : true;

const fitTone = { strong: "green", moderate: "info", weak: "neutral" } as const;

export default function LeadsPage({ searchParams }: PageProps<"/app/leads">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Leads searchParams={searchParams} />
    </Suspense>
  );
}

async function Leads({ searchParams }: { searchParams: PageProps<"/app/leads">["searchParams"] }) {
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.id === sp.f) ? sp.f : "all") as FilterId;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 80) : "";
  const all = await getLeads();
  const leads = all.filter((l) => keep(filter, l) && (!q || [l.name, l.website, l.email, l.address].some((v) => v?.toLowerCase().includes(q))));
  const researched = all.filter((l) => l.researched_at).length;
  const withEmail = all.filter((l) => l.email).length;
  const strong = all.filter((l) => l.fit === "strong").length;
  const pct = (n: number) => (all.length ? `${Math.round((n / all.length) * 100)}%` : "–");
  const href = (f: string) => `/app/leads?${new URLSearchParams({ ...(f !== "all" ? { f } : {}), ...(q ? { q } : {}) })}`;

  return (
    <div>
      <PageHero
        icon={Users}
        eyebrow="Your pipeline"
        title="Leads"
        description="Businesses you saved. Research each website to see what it's missing, find its public email, then write a personal first email."
        actions={
          <>
            <FindEmailsButton />
            <Button asChild>
              <Link href="/app/discover">
                <Search aria-hidden /> Find businesses
              </Link>
            </Button>
          </>
        }
        stats={[
          { label: "Saved leads", value: String(all.length) },
          { label: "Researched", value: pct(researched), hint: `${researched} of ${all.length}` },
          { label: "With a public email", value: pct(withEmail), hint: `${withEmail} of ${all.length}` },
          { label: "Strong fit", value: String(strong), hint: "for your offer" },
        ]}
      />

      {all.length ? (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
            <nav aria-label="Filter leads" className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => {
                const n = all.filter((l) => keep(f.id, l)).length;
                return (
                  <Link
                    key={f.id}
                    href={href(f.id)}
                    aria-current={filter === f.id ? "page" : undefined}
                    className={cn("rounded-lg border px-3 py-1.5 text-sm font-medium", filter === f.id ? "border-ink bg-ink text-white" : "border-line bg-surface text-slate hover:text-ink")}
                  >
                    {f.label} <span className="tabular-nums opacity-70">{n}</span>
                  </Link>
                );
              })}
            </nav>
            <form action="/app/leads" method="get" className="ml-auto flex items-center gap-2" role="search">
              {filter !== "all" ? <input type="hidden" name="f" value={filter} /> : null}
              <label htmlFor="lead-q" className="sr-only">Search leads</label>
              <input id="lead-q" name="q" defaultValue={q} placeholder="Search name, website, email…" className="h-9 w-56 rounded-lg border border-line-strong/60 bg-surface px-3 text-sm text-ink placeholder:text-slate/70 focus-visible:border-green focus-visible:outline-none" />
            </form>
          </div>
          {leads.length ? (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[920px] text-left text-sm">
                <caption className="sr-only">Saved leads</caption>
                <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">Business</th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">Website</th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">Public email</th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">Research</th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">Fit</th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">Source</th>
                    <th scope="col" className="py-2.5 pr-5 font-medium">Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.lead_id} className="border-b border-line last:border-b-0 hover:bg-canvas/50">
                      <td className="px-5 py-3">
                        <Link href={`/app/leads/${l.lead_id}`} className="font-medium text-ink hover:text-green hover:underline">
                          {l.name}
                        </Link>
                        <span className="block text-xs text-slate">
                          {l.niche ? nicheLabel(l.niche) : null}
                          {l.niche && (l.address ?? l.city) ? " · " : null}
                          {l.provider === "google_places" ? null : (l.address ?? l.city)}
                        </span>
                      </td>
                      <td className="max-w-[190px] truncate py-3 pr-3 font-mono text-xs text-slate">
                        {l.website ? (
                          <a href={l.website} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-green hover:underline">
                            {l.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                          </a>
                        ) : (
                          "Not listed"
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {l.email ? (
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="max-w-[200px] truncate font-mono text-xs text-ink">{l.email}</span>
                            <EmailStatusBadge status={(l.email_status ?? "unverified") as EmailStatus} />
                          </span>
                        ) : (
                          <NoEmailBadge />
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {l.researched_at ? <Badge tone={l.research_status === "ok" ? "green" : "warn"}>{l.research_status === "ok" ? "Done" : "Partly"}</Badge> : <Badge tone="outline">Not yet</Badge>}
                      </td>
                      <td className="py-3 pr-3">{l.fit ? <Badge tone={fitTone[l.fit as keyof typeof fitTone] ?? "neutral"}>{l.fit}</Badge> : <span className="text-xs text-slate">–</span>}</td>
                      <td className="py-3 pr-3">
                        {l.provider === "google_places" ? (
                          <a href={googleMapsLink(l.provider_ref, l.name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-green hover:underline">
                            Google Maps <ExternalLink aria-hidden className="size-3" />
                          </a>
                        ) : l.source_url ? (
                          <a href={l.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-green hover:underline">
                            OpenStreetMap <ExternalLink aria-hidden className="size-3" />
                          </a>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-5 text-xs text-slate">{formatDate(l.saved_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-slate">No leads match. <Link href="/app/leads">Clear filters</Link>.</p>
          )}
          {all.some((l) => l.provider !== "google_places") ? (
            <div className="border-t border-line px-5 py-3">
              <OsmCredit />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          <EmptyState icon={<Users />} title="No leads yet" action={<Button asChild><Link href="/app/discover">Run your first search</Link></Button>}>
            Search Google Maps for a type of business in an area. Locenti finds their websites and public emails; save the ones worth pitching.
          </EmptyState>
          <StepGuide
            steps={[
              { title: "Search", text: "Any business type, in any city. Up to 60 results per search, with ratings and websites." },
              { title: "Save", text: "Emails are found automatically. Keep the businesses that fit your offer." },
              { title: "Research and write", text: "See what each website is missing, then write a personal first email with AI." },
            ]}
          />
        </div>
      )}
    </div>
  );
}
