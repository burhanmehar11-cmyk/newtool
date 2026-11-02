import { Badge } from "@/components/ui/badge";
import type { CampaignStatus } from "@/demo/types";

const meta: Record<CampaignStatus, { label: string; tone: "neutral" | "green" | "warn" | "outline" | "info" }> = {
  draft: { label: "Draft", tone: "outline" },
  running: { label: "Running (simulated)", tone: "green" },
  paused: { label: "Paused", tone: "warn" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const m = meta[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
