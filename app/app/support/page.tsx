import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Clock, Hash, LifeBuoy, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { PageLoading } from "@/features/product/page-loading";
import { HelpCenter } from "@/features/support/help-center";
import { instantAnswers } from "@/lib/help-answers";
import { brand } from "@/config/brand";
import { QUICK_PICKS } from "@/lib/help-content";
import { formatDateTime } from "@/lib/utils";
import { ticketRef } from "@/server/support-store";
import { helpAssistantAvailable } from "@/server/services/help-assistant";
import { getMySupport, SUPPORT_TOPIC_OPTIONS } from "@/server/services/support";

export const metadata: Metadata = { title: "Help & Support" };

const STATUS: Record<string, { tone: "warn" | "green" | "neutral"; label: string }> = {
  needs_reply: { tone: "warn", label: "With our team" },
  waiting: { tone: "green", label: "We replied" },
  resolved: { tone: "neutral", label: "Solved" },
};

export default function HelpSupportPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <HelpSupport />
    </Suspense>
  );
}

async function HelpSupport() {
  const { ready, tickets } = await getMySupport();
  return (
    <div className="space-y-6">
      <section className="on-dark relative overflow-hidden rounded-2xl bg-midnight px-6 py-9 text-white sm:px-10 sm:py-11">
        <div aria-hidden className="hero-aurora pointer-events-none absolute -inset-[20%] opacity-70" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/80">
            <LifeBuoy aria-hidden className="size-3.5 text-mint" /> Help &amp; Support
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">How can we help?</h1>
          <p className="mt-3 text-[15px] leading-7 text-white/70">Quick answers for the common questions, an assistant for how-to questions, and a real person for everything else.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-white/85">
              <Clock aria-hidden className="size-3.5 text-mint" /> We aim to reply within a day
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-white/85">
              <Hash aria-hidden className="size-3.5 text-mint" /> A ticket number for every request
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-white/85">
              <Mail aria-hidden className="size-3.5 text-mint" /> Updates by email and here
            </span>
          </div>
        </div>
      </section>

      <HelpCenter picks={QUICK_PICKS} topics={SUPPORT_TOPIC_OPTIONS} assistant={helpAssistantAvailable()} ready={ready} instant={instantAnswers("app")} />

      <section aria-labelledby="mine-title" className="card overflow-hidden">
        <div className="flex items-baseline justify-between gap-2 border-b border-line px-5 py-4">
          <h2 id="mine-title" className="font-display text-base font-semibold text-ink">
            Your requests
          </h2>
          {tickets.length ? <span className="text-xs text-slate">{tickets.length} total</span> : null}
        </div>
        {tickets.length ? (
          <ul className="divide-y divide-line">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/app/support/${t.id}`} className="group flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-canvas">
                  <span className="rounded-md bg-canvas px-2 py-1 font-mono text-xs font-semibold text-ink">{ticketRef(t)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{t.subject}</span>
                    <span className="block truncate text-xs text-slate">{t.preview ?? ""}</span>
                  </span>
                  <span className="text-xs text-slate">{formatDateTime(t.updated_at)}</span>
                  <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
                  <ChevronRight aria-hidden className="size-4 text-slate transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState icon={<LifeBuoy />} title="No requests yet">
              When you ask the team something, it shows up here with its ticket number.
            </EmptyState>
          </div>
        )}
      </section>

      <p className="pb-2 text-center text-sm text-slate">
        Prefer email?{" "}
        <a href={`mailto:${brand.supportEmail}`} className="font-medium text-green hover:underline">
          {brand.supportEmail}
        </a>{" "}
        — it lands in the same place.
      </p>
    </div>
  );
}
