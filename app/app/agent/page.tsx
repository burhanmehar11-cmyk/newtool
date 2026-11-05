import type { Metadata } from "next";
import { Suspense } from "react";
import { Bot, CircleCheck, CircleDashed, Sparkles } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Callout } from "@/components/ui/misc";
import { brand } from "@/config/brand";
import { PageLoading } from "@/features/product/page-loading";
import { AgentsCard } from "@/features/settings/agents-card";
import { requireWorkspace } from "@/server/auth";
import { configuredSiteUrl } from "@/server/env";
import { aiWriterStatus } from "@/server/services/ai-writer";
import { getMyTokens } from "@/server/services/tokens";
import { getUsage } from "@/server/services/workspaces";

export const metadata: Metadata = { title: "Agent" };

export default function AgentPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Agent />
    </Suspense>
  );
}

async function Agent() {
  const { workspace } = await requireWorkspace("/app/agent");
  const [tokens, usage] = await Promise.all([getMyTokens(), getUsage(workspace)]);
  const ai = aiWriterStatus();
  const units = usage.find((u) => u.kind === "ai");
  const left = units ? Math.max(0, units.allowance - units.used - units.reserved) : null;
  return (
    <div>
      <PageHeader title="Agent" description="Two ways to write emails with AI: the built-in writer, or your own AI agent connected over MCP. Either way, you approve before anything is sent." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <SectionCard title={<span className="inline-flex items-center gap-2"><Sparkles aria-hidden className="size-4 text-green" /> Built-in AI writer</span>} description="Writes each lead's first email from its research and your offer.">
          <div className="space-y-4 text-sm">
            <p className="flex items-start gap-2.5">
              {ai.configured ? <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-green" /> : <CircleDashed aria-hidden className="mt-0.5 size-4 shrink-0 text-slate" />}
              <span>
                <span className="block font-medium text-ink">{ai.configured ? "Ready" : "Not set up"}</span>
                <span className="block text-xs text-slate">{ai.configured ? `Google Gemini · ${ai.model}` : "Needs a Gemini API key on the server (GEMINI_API_KEY)."}</span>
              </span>
            </p>
            {left !== null ? (
              <p className="text-slate">
                <span className="font-medium text-ink">{left}</span> of {units!.allowance} AI emails left this period. Failed attempts aren&apos;t counted.
              </p>
            ) : null}
            <ul className="list-disc space-y-1 pl-5 text-slate">
              <li>Uses only the lead&apos;s Opportunity Brief (facts with sources) and your offer profile.</li>
              <li>Never invents names, numbers, reviews or problems; checks the result for placeholders and stray links.</li>
              <li>Find it on each lead (First email) and in draft campaigns (Write all with AI).</li>
            </ul>
            <Callout tone="info">
              Gemini&apos;s free tier lets Google use what&apos;s sent to it (lead research and your offer) to improve its products. A paid Gemini plan, or your own agent below, avoids that.
            </Callout>
          </div>
        </SectionCard>
        <SectionCard title={<span className="inline-flex items-center gap-2"><Bot aria-hidden className="size-4 text-green" /> Your own AI agent (MCP)</span>} description="Bring your own AI. Tokens are personal to you and this workspace.">
          <AgentsCard tokens={tokens} endpoint={`${configuredSiteUrl() ?? brand.siteUrl}/api/mcp`} />
        </SectionCard>
      </div>
    </div>
  );
}
