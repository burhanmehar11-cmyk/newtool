import type { Metadata } from "next";
import { Suspense } from "react";
import { brand } from "@/config/brand";
import { AgentHub } from "@/features/agent/agent-hub";
import { ApiReference, WebhooksSection } from "@/features/agent/developers";
import { getWebhooks } from "@/server/services/webhooks";
import { PageLoading } from "@/features/product/page-loading";
import { requireWorkspace } from "@/server/auth";
import { configuredSiteUrl } from "@/server/env";
import { mcpTools } from "@/server/mcp/tools";
import {
  googlePlacesConfigured,
  remainingToday,
} from "@/server/providers/google-places";
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
  const [tokens, usage, googleLeft] = await Promise.all([
    getMyTokens(),
    getUsage(workspace),
    googlePlacesConfigured()
      ? remainingToday().catch(() => null)
      : Promise.resolve(null),
  ]);
  const hooks = await getWebhooks();
  const base = configuredSiteUrl() ?? brand.siteUrl;
  const ai = aiWriterStatus();
  const units = usage.find((u) => u.kind === "ai");
  return (
    <div className="space-y-6">
      <AgentHub
        tokens={tokens}
        endpoint={`${configuredSiteUrl() ?? brand.siteUrl}/api/mcp`}
        toolNames={mcpTools.map((t) => t.name)}
        ai={{
          ...ai,
          left: units
            ? Math.max(0, units.allowance - units.used - units.reserved)
            : null,
          allowance: units?.allowance ?? null,
        }}
        google={{ configured: googlePlacesConfigured(), left: googleLeft }}
        canManage={["owner", "admin"].includes(workspace.role)}
      />
      <ApiReference base={base} />
      <WebhooksSection hooks={hooks} />
    </div>
  );
}
