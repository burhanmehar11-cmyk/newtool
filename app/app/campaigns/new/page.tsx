import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { PageLoading } from "@/features/product/page-loading";
import { NewCampaignForm } from "@/features/campaigns/new-campaign-form";
import { getNewCampaignData } from "@/server/services/campaigns";

export const metadata: Metadata = { title: "New campaign" };

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewCampaign />
    </Suspense>
  );
}

async function NewCampaign() {
  const { leads, mailboxes, hasOffer } = await getNewCampaignData();
  return (
    <div>
      <Link href="/app/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> All campaigns
      </Link>
      <PageHeader title="New campaign" description="Pick researched leads and a mailbox. You'll review every message before anything is sent." />
      <div className="max-w-3xl">
        <SectionCard>
          <NewCampaignForm leads={leads} mailboxes={mailboxes} hasOffer={hasOffer} />
        </SectionCard>
      </div>
    </div>
  );
}
