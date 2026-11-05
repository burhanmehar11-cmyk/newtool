import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/misc";
import { PageLoading } from "@/features/product/page-loading";
import { LabelSelect, MarkRead } from "@/features/inbox/reply-controls";
import { getThreadDetail } from "@/server/services/replies";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Reply" };

export default function ThreadPage({ params }: PageProps<"/app/inbox/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Thread params={params} />
    </Suspense>
  );
}

async function Thread({ params }: { params: PageProps<"/app/inbox/[id]">["params"] }) {
  const { id } = await params;
  const d = await getThreadDetail(id);
  const back = (
    <Link href="/app/inbox" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate hover:text-ink">
      <ArrowLeft aria-hidden className="size-4" /> Inbox
    </Link>
  );
  if (!d)
    return (
      <div>
        {back}
        <EmptyState title="Conversation not found">It may belong to another workspace.</EmptyState>
      </div>
    );
  const t = d.thread;
  const gmail = t.mailbox_email ? `https://mail.google.com/mail/u/${encodeURIComponent(t.mailbox_email)}/#all/${t.provider_thread_id}` : null;
  return (
    <div>
      <MarkRead id={t.id} unread={t.unread} />
      {back}
      <PageHeader
        title={t.name ?? t.subject}
        description={
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span>{t.subject}</span>
            {t.campaign_id ? <Link href={`/app/campaigns/${t.campaign_id}`}>{t.campaign_name}</Link> : null}
            {t.lead_id ? <Link href={`/app/leads/${t.lead_id}`}>Lead</Link> : null}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LabelSelect id={t.id} value={t.classification} />
            {gmail ? (
              <a href={gmail} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line-strong/60 bg-surface px-3 text-sm font-medium text-ink hover:bg-canvas">
                Reply in Gmail <ExternalLink aria-hidden className="size-3.5" />
              </a>
            ) : null}
          </div>
        }
      />
      <ol className="max-w-3xl space-y-3">
        {d.messages.map((m) => (
          <li key={m.id} className={cn("card p-4", m.direction === "outbound" ? "sm:mr-10" : "border-green/30 sm:ml-10")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate">
              <span>
                <span className="font-medium text-ink">{m.direction === "outbound" ? "You" : m.from_addr}</span> → {m.to_addr}
              </span>
              <span>{formatDateTime(m.occurred_at)} UTC</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{m.body_text || "(no text)"}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 max-w-3xl text-xs text-slate">Shown as plain text with quoted history removed. Reply from Gmail; Locenti picks up the conversation on its next check.</p>
    </div>
  );
}
