import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, Send } from "lucide-react";
import { SectionCard } from "@/components/app/page-header";
import { PageHero, StepGuide } from "@/components/app/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PageLoading } from "@/features/product/page-loading";
import { DoNotContact } from "@/features/campaigns/do-not-contact";
import { requireWorkspace } from "@/server/auth";
import { getCampaignsOverview } from "@/server/services/campaigns";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Campaigns" };

const statusTone = { draft: "outline", running: "green", paused: "warn", completed: "info", cancelled: "neutral" } as const;

export default function CampaignsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Campaigns />
    </Suspense>
  );
}

async function Campaigns() {
  const { workspace } = await requireWorkspace("/app/campaigns");
  const { campaigns, suppressions } = await getCampaignsOverview();
  const canManage = ["owner", "admin"].includes(workspace.role);
  const sum = (k: "sent" | "replied" | "interested") => campaigns.reduce((a, c) => a + Number(c[k] ?? 0), 0);
  const sent = sum("sent");
  const replied = sum("replied");
  return (
    <div>
      <PageHero
        icon={Send}
        eyebrow="Outreach"
        title="Campaigns"
        description="Personal first emails to your leads, sent from your Gmail only after you approve them. Sending is paced, stays inside your sending window, and stops the moment someone replies."
        stats={[
          { label: "Running", value: String(campaigns.filter((c) => c.status === "running").length), hint: `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} in total` },
          { label: "Emails sent", value: sent.toLocaleString("en-US") },
          { label: "Replies", value: replied.toLocaleString("en-US"), hint: sent ? `${((replied / sent) * 100).toFixed(1)}% reply rate` : undefined },
          { label: "Interested", value: sum("interested").toLocaleString("en-US") },
        ]}
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/app/campaigns/new">
                <Plus aria-hidden /> New campaign
              </Link>
            </Button>
          ) : null
        }
      />
      {!campaigns.length ? (
        <div className="mb-5">
          <StepGuide
            steps={[
              { title: "Pick your leads", text: "Leads with a public email can join a campaign." },
              { title: "Review every email", text: "Each lead gets a first email written from its website. Edit any of them." },
              { title: "Approve and send", text: "Emails go out from your Gmail, paced and inside your sending window." },
            ]}
          />
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        {campaigns.length ? (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">Campaigns</caption>
                <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">Campaign</th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">Status</th>
                    <th scope="col" className="py-2.5 pr-3 text-right font-medium">Recipients</th>
                    <th scope="col" className="py-2.5 pr-3 text-right font-medium">Sent</th>
                    <th scope="col" className="py-2.5 pr-3 text-right font-medium">Queued</th>
                    <th scope="col" className="py-2.5 pr-3 text-right font-medium">Replies</th>
                    <th scope="col" className="py-2.5 pr-5 text-right font-medium">Interested</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-3">
                        <Link href={`/app/campaigns/${c.id}`} className="font-medium text-ink hover:text-green hover:underline">
                          {c.name}
                        </Link>
                        <span className="block text-xs text-slate">Created {formatDate(c.created_at)}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone={statusTone[c.status]}>{c.status === "draft" ? "Draft · not approved" : c.status}</Badge>
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">{c.recipients}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{c.sent}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{c.queued}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{c.replied}</td>
                      <td className="py-3 pr-5 text-right tabular-nums text-green">{c.interested}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Send />}
            title="No campaigns yet"
            action={
              canManage ? (
                <Button asChild>
                  <Link href="/app/campaigns/new">Create a campaign</Link>
                </Button>
              ) : null
            }
          >
            Research a few leads first; each campaign writes a first email per lead from what its website shows. You review and approve before anything is sent.
          </EmptyState>
        )}
        <SectionCard title="Do not contact" description="Never emailed from this workspace, in any campaign.">
          <DoNotContact entries={suppressions} canManage={canManage} />
        </SectionCard>
      </div>
    </div>
  );
}
