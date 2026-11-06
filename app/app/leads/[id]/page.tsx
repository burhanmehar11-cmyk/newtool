import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, FileSearch, Globe, MapPin, Phone } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Callout, EmptyState } from "@/components/ui/misc";
import { EmailStatusBadge, NoEmailBadge, emailStatusMeta } from "@/components/product/badges";
import { EvidenceItem } from "@/components/product/evidence";
import { OpportunityBriefView } from "@/components/product/opportunity-brief";
import { PageLoading } from "@/features/product/page-loading";
import { OsmCredit } from "@/features/product/osm-credit";
import { GoogleDetails } from "@/features/product/google-search";
import { CheckEmailButton, NotesEditor, ResearchButton, WriteWithAiButton } from "@/features/product/lead-actions";
import { aiWriterStatus } from "@/server/services/ai-writer";
import { nicheWords } from "@/lib/discovery/niches";
import { offerTypeLabels } from "@/lib/domain/labels";
import type { EmailStatus, Evidence } from "@/lib/domain/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { requireWorkspace } from "@/server/auth";
import { toBusiness } from "@/server/research-store";
import { getLatestDraft, getLeadDetail } from "@/server/services/research";
import { getOfferProfile } from "@/server/services/workspaces";

export const metadata: Metadata = { title: "Lead" };

export default function LeadPage({ params }: PageProps<"/app/leads/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Lead params={params} />
    </Suspense>
  );
}

const researchLabel: Record<string, { tone: "green" | "warn" | "danger" | "neutral"; text: string }> = {
  ok: { tone: "green", text: "Website read" },
  partial: { tone: "warn", text: "Partly read" },
  no_website: { tone: "neutral", text: "No website" },
  blocked: { tone: "warn", text: "Blocked by robots.txt" },
  failed: { tone: "danger", text: "Couldn't read website" },
};

async function Lead({ params }: { params: PageProps<"/app/leads/[id]">["params"] }) {
  const { id } = await params;
  const { workspace } = await requireWorkspace(`/app/leads/${id}`);
  const [d, offer, draft] = await Promise.all([getLeadDetail(id), getOfferProfile(workspace), getLatestDraft(id)]);
  const ai = aiWriterStatus();
  if (!d) {
    return (
      <div>
        <BackLink />
        <EmptyState title="Lead not found">It may have been removed, or it belongs to another workspace.</EmptyState>
      </div>
    );
  }
  const b = d.business;
  const business = toBusiness(d);
  const stale = !!(d.brief && offer && d.brief.offerType !== offer.serviceType);
  const words = nicheWords(b.niche);
  const evidence: Evidence[] = d.evidence
    .filter((e) => e.kind !== "other")
    .map((e) => ({ id: e.id, businessId: b.id, kind: e.kind as Evidence["kind"], label: e.label, url: e.url, collectedAt: e.collected_at, excerpt: e.excerpt }));
  const status = b.research_status ? researchLabel[b.research_status] : null;
  const fromGoogle = b.provider === "google_places";

  return (
    <div>
      <BackLink />
      <PageHeader
        title={b.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>{b.niche ? words.singular : b.category ?? "Business"}</span>
            {fromGoogle && !b.researched_at ? <span>Name shown is the website&apos;s domain until you research it</span> : null}
            {b.address ? (
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden className="size-3.5" /> {b.address}
              </span>
            ) : null}
            {b.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone aria-hidden className="size-3.5" /> {b.phone}
              </span>
            ) : null}
            {b.website ? (
              <a href={b.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-green hover:underline">
                <Globe aria-hidden className="size-3.5" /> {b.domain_normalized ?? "Website"}
              </a>
            ) : (
              <span>No website listed</span>
            )}
          </span>
        }
        actions={<ResearchButton leadId={d.leadId} researched={!!b.researched_at} />}
      />

      {!offer ? (
        <Callout tone="warn" className="mb-5" title="Add your offer profile first">
          Research is scored against what you sell. <Link href="/app/settings">Open Settings</Link>.
        </Callout>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <SectionCard
          title="Opportunity Brief"
          description={offer ? `Scored for: ${offerTypeLabels[offer.serviceType]}` : undefined}
          actions={status ? <Badge tone={status.tone}>{status.text}</Badge> : null}
        >
          {d.brief ? (
            <>
              {stale ? (
                <Callout tone="warn" className="mb-4">
                  This brief was scored for a different offer. Research again to re-score it.
                </Callout>
              ) : null}
              <OpportunityBriefView brief={d.brief} business={{ ...business, evidence }} stale={stale} live />
            </>
          ) : (
            <EmptyState icon={<FileSearch />} title="Not researched yet">
              Research reads a few public pages of the website (homepage, contact, booking or forms), notes what it observes with the exact
              source, and scores the fit for your offer. Anything it can&apos;t see is marked Unknown.
            </EmptyState>
          )}
          {b.research_note ? (
            <p className="mt-4 text-xs leading-5 text-slate">
              Last research {b.researched_at ? `${formatDateTime(b.researched_at)} UTC` : ""}: {b.research_note}
            </p>
          ) : null}
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="First email" description={draft ? `Version ${draft.version} · ${draft.origin === "ai" ? "written by AI" : draft.origin === "agent" ? "written by your agent" : draft.origin === "edited" ? "edited by you" : "from the brief template"}` : "Not written yet."}>
            {draft ? (
              <div className="mb-4 rounded-lg border border-line bg-canvas p-3">
                <p className="text-sm font-medium text-ink">{draft.subject}</p>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-ink/90">{draft.body}</p>
              </div>
            ) : null}
            <WriteWithAiButton
              leadId={d.leadId}
              hasDraft={!!draft}
              disabledReason={!ai.configured ? "The AI writer isn't set up yet (see the Agent page)." : !d.brief ? "Research the website first; the email is written from what it shows." : null}
            />
            <p className="mt-3 text-xs text-slate">Edit messages and send them from a campaign. Nothing is sent from here.</p>
          </SectionCard>

          <SectionCard title="Contacts" description="Emails published by the business on its listing or website.">
            {d.contacts.length ? (
              <ul className="space-y-3">
                {d.contacts.map((c) => (
                  <li key={c.id} className="rounded-[10px] border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] text-ink">{c.email_normalized}</span>
                      <EmailStatusBadge status={c.status} />
                      <span className="text-xs text-slate">{c.kind === "role" ? "Role address" : "Personal address"}</span>
                    </div>
                    {c.verification_detail || emailStatusMeta[c.status as EmailStatus].help ? <p className="mt-1.5 text-xs leading-5 text-slate">{c.verification_detail ?? emailStatusMeta[c.status as EmailStatus].help}</p> : null}
                    {c.verified_at ? (
                      <p className="mt-0.5 text-xs text-slate">
                        Checked {formatDate(c.verified_at)} · {c.verification_provider === "dns-check" ? "free DNS check (can't confirm mailboxes)" : c.verification_provider}
                      </p>
                    ) : null}
                    {!c.verification_provider || c.verification_provider === "dns-check" ? (
                      <div className="mt-2">
                        <CheckEmailButton contactId={c.id} leadId={d.leadId} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate">
                <NoEmailBadge /> None found yet. Research the website to look for a published address. Names are never guessed.
              </div>
            )}
          </SectionCard>

          {fromGoogle ? (
            <SectionCard title="Google Maps listing" description="Found on Google Maps. Locenti stores only the place ID.">
              <GoogleDetails placeId={b.provider_ref} label={b.name} />
            </SectionCard>
          ) : null}

          <SectionCard title="Sources">
            {evidence.length ? (
              <div className="space-y-1.5">
                {evidence.map((e) => (
                  <EvidenceItem key={e.id} evidence={e} live />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate">No sources yet.</p>
            )}
            {fromGoogle ? null : (
              <div className="mt-4">
                <OsmCredit />
              </div>
            )}
          </SectionCard>

          <SectionCard title="Notes">
            <NotesEditor leadId={d.leadId} initial={d.notes} />
            <p className="mt-3 text-xs text-slate">Lead saved {formatDate(d.savedAt)}</p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/app/leads" className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-slate hover:text-ink">
      <ArrowLeft aria-hidden className="size-4" /> All leads
    </Link>
  );
}
