import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { EmailStatusBadge, NoEmailBadge } from "@/components/product/badges";
import { PageLoading } from "@/features/product/page-loading";
import { OsmCredit } from "@/features/product/osm-credit";
import { googleMapsLink } from "@/lib/discovery/google-places";
import { getLeads } from "@/server/services/discovery";
import type { EmailStatus } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Leads />
    </Suspense>
  );
}

async function Leads() {
  const leads = await getLeads();
  return (
    <div>
      <PageHeader
        title="Leads"
        description="Businesses you chose to save. Open one to research its website and check its email."
        actions={
          <Button asChild>
            <Link href="/app/discover">Find businesses</Link>
          </Button>
        }
      />
      {leads.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Saved leads</caption>
              <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Business</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Website</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Public email</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Source</th>
                  <th scope="col" className="py-2.5 pr-5 font-medium">Saved</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.lead_id} className="border-b border-line last:border-b-0">
                    <td className="px-5 py-3">
                      <Link href={`/app/leads/${l.lead_id}`} className="font-medium text-ink hover:text-green hover:underline">
                        {l.name}
                      </Link>
                      <span className="block text-xs text-slate">
                        {l.provider === "google_places" ? (l.address ?? "Open the lead for Google Maps details") : (l.address ?? l.city ?? "Address not listed")}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate py-3 pr-3 font-mono text-xs text-slate">
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
                          <span className="font-mono text-xs text-ink">{l.email}</span>
                          <EmailStatusBadge status={(l.email_status ?? "unverified") as EmailStatus} />
                        </span>
                      ) : (
                        <NoEmailBadge />
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {l.provider === "google_places" ? (
                        <a href={googleMapsLink(l.provider_ref, l.name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-green hover:underline">
                          Google Maps <ExternalLink aria-hidden className="size-3" />
                        </a>
                      ) : l.source_url ? (
                        <a href={l.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-green hover:underline">
                          OSM listing <ExternalLink aria-hidden className="size-3" />
                        </a>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-5 text-xs text-slate">{formatDate(l.saved_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leads.some((l) => l.provider !== "google_places") ? (
            <div className="border-t border-line px-5 py-3">
              <OsmCredit />
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState icon={<Users />} title="No leads yet" action={<Button asChild><Link href="/app/discover">Run a search</Link></Button>}>
          Search for businesses, then save the ones you want to work on. Nothing is saved or contacted automatically.
        </EmptyState>
      )}
    </div>
  );
}
