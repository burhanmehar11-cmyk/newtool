import { CircleCheck, CircleDashed, CircleHelp, CircleX, Loader2, MailWarning, ShieldBan, Sparkles } from "lucide-react";
import type { Confidence, EmailStatus, FitLevel } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";

export const emailStatusMeta: Record<EmailStatus, { label: string; tone: "green" | "danger" | "warn" | "neutral" | "outline"; help: string }> = {
  valid: { label: "Valid", tone: "green", help: "The verifier confirmed the mailbox accepts mail. This reduces uncertainty; it does not guarantee delivery." },
  invalid: { label: "Invalid", tone: "danger", help: "The mailbox does not exist or rejects mail. Never sent to." },
  catch_all: { label: "Catch-all", tone: "warn", help: "The domain accepts every address, so this one cannot be confirmed. Excluded by default." },
  unknown: { label: "Unknown", tone: "neutral", help: "The check was inconclusive. Excluded by default." },
  unverified: { label: "Unverified", tone: "outline", help: "Not checked yet. Must be verified before it can be sent to." },
};

export function EmailStatusBadge({ status, verifying, suppressed }: { status: EmailStatus; verifying?: boolean; suppressed?: boolean }) {
  if (suppressed)
    return (
      <Badge tone="danger" title="On the workspace suppression list. Never sent to.">
        <ShieldBan aria-hidden /> Suppressed
      </Badge>
    );
  if (verifying)
    return (
      <Badge tone="info">
        <Loader2 aria-hidden className="animate-spin" /> Verifying
      </Badge>
    );
  const m = emailStatusMeta[status];
  const Icon = status === "valid" ? CircleCheck : status === "invalid" ? CircleX : status === "catch_all" ? MailWarning : status === "unknown" ? CircleHelp : CircleDashed;
  return (
    <Badge tone={m.tone} title={m.help}>
      <Icon aria-hidden /> {m.label}
    </Badge>
  );
}

export function NoEmailBadge() {
  return (
    <Badge tone="outline" title="No public email was found on the sources checked.">
      <CircleDashed aria-hidden /> No email found
    </Badge>
  );
}

const fitTone = { strong: "green", moderate: "info", weak: "neutral" } as const;

export function FitBadge({ level, stale }: { level: FitLevel; stale?: boolean }) {
  return (
    <Badge tone={stale ? "outline" : fitTone[level]} title={stale ? "Researched for a different offer. Research again to update." : "Offer fit is a prioritisation aid, not a prediction that the business will buy."}>
      {level === "strong" ? "Strong fit" : level === "moderate" ? "Moderate fit" : "Weak fit"}
      {stale ? " · outdated" : ""}
    </Badge>
  );
}

export function ConfidenceBadge({ level }: { level: Confidence }) {
  return (
    <Badge tone="outline" title="How much of the scoring rubric could be checked from collected sources.">
      {level === "high" ? "High" : level === "medium" ? "Medium" : "Low"} confidence
    </Badge>
  );
}

export function AiSuggestionBadge({ dark }: { dark?: boolean }) {
  return (
    <Badge tone={dark ? "mint-dark" : "info"} title="Inferred from the facts. Review before relying on it.">
      <Sparkles aria-hidden /> AI suggestion
    </Badge>
  );
}

export function SampleBadge({ dark, label = "Sample data" }: { dark?: boolean; label?: string }) {
  return (
    <Badge tone={dark ? "dark" : "demo"} className="uppercase tracking-[0.06em] text-[10px]">
      {label}
    </Badge>
  );
}
