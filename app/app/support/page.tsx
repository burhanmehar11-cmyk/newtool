import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LifeBuoy } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { PageLoading } from "@/features/product/page-loading";
import { NewRequestForm } from "@/features/support/user-support";
import { brand } from "@/config/brand";
import { formatDateTime } from "@/lib/utils";
import { getMySupport, SUPPORT_TOPIC_OPTIONS } from "@/server/services/support";

export const metadata: Metadata = { title: "Support" };

const STATUS: Record<string, { tone: "warn" | "green" | "neutral"; label: string }> = {
  needs_reply: { tone: "neutral", label: "Waiting for us" },
  waiting: { tone: "green", label: "We replied" },
  resolved: { tone: "neutral", label: "Solved" },
};

export default function SupportPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Support />
    </Suspense>
  );
}

async function Support() {
  const { ready, tickets } = await getMySupport();
  return (
    <div className="space-y-5">
      <PageHeader title="Support" description={`Ask us anything: something not working, a question about your plan, or an idea. We usually reply within a day, by email and here.`} />
      <SectionCard title="New request">
        {ready ? <NewRequestForm topics={SUPPORT_TOPIC_OPTIONS} /> : <p className="text-sm text-slate">Support requests open soon. Meanwhile, email us at {brand.supportEmail}.</p>}
      </SectionCard>
      <SectionCard title="Your requests" bodyClassName="p-0">
        {tickets.length ? (
          <ul className="divide-y divide-line">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/app/support/${t.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-canvas">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{t.subject}</span>
                    <span className="block truncate text-xs text-slate">{t.preview ?? ""}</span>
                  </span>
                  <span className="text-xs text-slate">{formatDateTime(t.updated_at)}</span>
                  <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState icon={<LifeBuoy />} title="No requests yet">
              When you send one, the conversation shows up here.
            </EmptyState>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
