import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/features/product/page-loading";
import { ReplyBox } from "@/features/support/user-support";
import { formatDateTime, cn } from "@/lib/utils";
import { getMyTicketDetail } from "@/server/services/support";
import { ticketRef } from "@/server/support-store";
import { Callout } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Help & Support request" };

export default function SupportTicketPage({ params, searchParams }: PageProps<"/app/support/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Ticket params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Ticket({ params, searchParams }: Pick<PageProps<"/app/support/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const isNew = (await searchParams).new === "1";
  const d = await getMyTicketDetail(id);
  if (!d) notFound();
  const { ticket, messages } = d;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {isNew ? (
        <Callout tone="green" title={`We've received your request ${ticketRef(ticket)}`}>
          We sent a confirmation to your email. Someone from our team will get back to you soon, usually within a day. You&apos;ll get their reply by email and here.
        </Callout>
      ) : null}
      <PageHeader
        title={ticket.subject}
        description={`${ticketRef(ticket)} · opened ${formatDateTime(ticket.created_at)}`}
        actions={<Badge tone={ticket.status === "waiting" ? "green" : "neutral"}>{ticket.status === "needs_reply" ? "Waiting for us" : ticket.status === "waiting" ? "We replied" : "Solved"}</Badge>}
      />
      <ol className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className={cn("max-w-[85%] rounded-2xl border px-4 py-3", m.author === "customer" ? "ml-auto border-line bg-surface" : "border-green/30 bg-mint-soft/40")}>
            <p className="text-xs font-semibold text-slate">
              {m.author === "customer" ? "You" : "The Locenti Team"} · {formatDateTime(m.created_at)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">{m.body}</p>
          </li>
        ))}
      </ol>
      <div className="card p-4">
        <ReplyBox id={ticket.id} resolved={ticket.status === "resolved"} />
      </div>
    </div>
  );
}
