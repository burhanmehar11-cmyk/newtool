import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { PageLoading } from "@/features/product/page-loading";
import { CampaignView } from "@/features/campaigns/campaign-view";
import { getCampaignDetail } from "@/server/services/campaigns";

export const metadata: Metadata = { title: "Campaign" };

const tone = { draft: "outline", running: "green", paused: "warn", completed: "info", cancelled: "neutral" } as const;
const label = { draft: "Draft · not approved", running: "Running", paused: "Paused", completed: "Completed", cancelled: "Cancelled" } as const;

export default function CampaignPage({ params }: PageProps<"/app/campaigns/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Campaign params={params} />
    </Suspense>
  );
}

async function Campaign({ params }: { params: PageProps<"/app/campaigns/[id]">["params"] }) {
  const { id } = await params;
  const d = await getCampaignDetail(id);
  const back = (
    <Link href="/app/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate hover:text-ink">
      <ArrowLeft aria-hidden className="size-4" /> All campaigns
    </Link>
  );
  if (!d)
    return (
      <div>
        {back}
        <EmptyState title="Campaign not found">It may belong to another workspace, or the link is wrong.</EmptyState>
      </div>
    );
  return (
    <div>
      {back}
      <PageHeader title={d.campaign.name} actions={<Badge tone={tone[d.campaign.status]}>{label[d.campaign.status]}</Badge>} />
      <CampaignView campaign={d.campaign} recipients={d.recipients} mailboxes={d.mailboxes} canManage={d.canManage} aiConfigured={d.aiConfigured} followUps={d.followUps} />
    </div>
  );
}
