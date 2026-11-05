import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Inbox as InboxIcon } from "lucide-react";
import { PageHero } from "@/components/app/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PageLoading } from "@/features/product/page-loading";
import { CheckRepliesButton } from "@/features/inbox/reply-controls";
import { getInbox } from "@/server/services/replies";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Inbox" };

const kindMeta = {
  interested: { label: "Interested", tone: "green" },
  not_interested: { label: "Not interested", tone: "neutral" },
  out_of_office: { label: "Out of office", tone: "info" },
  bounce: { label: "Bounced", tone: "danger" },
  unclassified: { label: "Needs a look", tone: "warn" },
} as const;

export default function InboxPage({ searchParams }: PageProps<"/app/inbox">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Inbox searchParams={searchParams} />
    </Suspense>
  );
}

async function Inbox({ searchParams }: { searchParams: PageProps<"/app/inbox">["searchParams"] }) {
  const sp = await searchParams;
  const { threads, counts, filter, trackingOn } = await getInbox(typeof sp.filter === "string" ? sp.filter : "all");
  const total = counts.reduce((a, c) => a + c.n, 0);
  const count = (k: string) => counts.find((c) => c.classification === k)?.n ?? 0;
  const tabs = [["all", "All", total] as const, ...Object.entries(kindMeta).map(([k, m]) => [k, m.label, counts.find((c) => c.classification === k)?.n ?? 0] as const)];
  return (
    <div>
      <PageHero
        icon={InboxIcon}
        eyebrow="Replies"
        title="Inbox"
        description="Replies to your campaign emails, sorted for you. Labels are suggestions; change any of them. Someone who replies, bounces or opts out gets no more emails from that campaign."
        actions={trackingOn ? <CheckRepliesButton /> : null}
        stats={
          trackingOn
            ? [
                { label: "Replies", value: String(total) },
                { label: "Interested", value: String(count("interested")) },
                { label: "Needs a look", value: String(count("unclassified")) },
                { label: "Bounced", value: String(count("bounce")) },
              ]
            : undefined
        }
      />
      {!trackingOn ? (
        <EmptyState icon={<InboxIcon />} title="Reply tracking is off" action={<Button asChild><Link href="/app/mailboxes">Turn it on</Link></Button>}>
          Turn on reply tracking for your mailbox so Locenti can read replies to campaign emails, sort them, and stop emailing people who say no or whose address bounced. It only reads threads that Locenti started.
        </EmptyState>
      ) : (
        <>
          <nav aria-label="Filter replies" className="mb-4 flex flex-wrap gap-1.5">
            {tabs.map(([k, label, n]) => (
              <Link
                key={k}
                href={k === "all" ? "/app/inbox" : `/app/inbox?filter=${k}`}
                aria-current={filter === k ? "page" : undefined}
                className={cn("rounded-lg border px-3 py-1.5 text-sm font-medium", filter === k ? "border-ink bg-ink text-white" : "border-line bg-surface text-slate hover:text-ink")}
              >
                {label} <span className="tabular-nums opacity-70">{n}</span>
              </Link>
            ))}
          </nav>
          {threads.length ? (
            <ul className="card divide-y divide-line overflow-hidden">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link href={`/app/inbox/${t.id}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-canvas">
                    <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", t.unread ? "bg-green" : "bg-transparent")} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={cn("truncate text-sm text-ink", t.unread && "font-semibold")}>{t.name ?? t.last_from ?? "Unknown sender"}</span>
                        <Badge tone={kindMeta[t.classification].tone}>{kindMeta[t.classification].label}</Badge>
                        {t.classification_source === "user" ? <span className="text-[11px] text-slate">labelled by you</span> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate">{t.subject}{t.campaign_name ? ` · ${t.campaign_name}` : ""}</span>
                      <span className="mt-1 block line-clamp-2 text-[13px] leading-5 text-ink/80">{t.last_text}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate">{formatDateTime(t.last_inbound_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<InboxIcon />} title={filter === "all" ? "No replies yet" : "Nothing here"}>
              {filter === "all" ? "Replies to campaign emails appear here a few minutes after they arrive, while Locenti is open." : "No replies with this label."}
            </EmptyState>
          )}
        </>
      )}
    </div>
  );
}
