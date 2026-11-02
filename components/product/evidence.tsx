"use client";

import * as React from "react";
import { ChevronDown, FileText, Globe, ListChecks, MapPin, MessageSquareText } from "lucide-react";
import type { Evidence } from "@/lib/domain/types";
import { cn, formatDate } from "@/lib/utils";

const icons = { listing: MapPin, homepage: Globe, contact_page: FileText, reviews: MessageSquareText, forms_page: ListChecks } as const;

/** One source record. In the demo, URLs are reserved `.example` addresses and are not opened. */
export function EvidenceItem({
  evidence,
  defaultOpen,
  dark,
  onOpen,
}: {
  evidence: Evidence;
  defaultOpen?: boolean;
  dark?: boolean;
  onOpen?: () => void;
}) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  const Icon = icons[evidence.kind];
  const id = React.useId();
  return (
    <div className={cn("rounded-[10px] border", dark ? "border-line-dark bg-midnight/60" : "border-line bg-surface")}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) onOpen?.();
        }}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[13px] transition-colors duration-200",
          dark ? "hover:bg-white/[0.04]" : "hover:bg-canvas",
        )}
      >
        <Icon aria-hidden className={cn("size-3.5 shrink-0", dark ? "text-mint" : "text-green")} />
        <span className={cn("font-medium", dark ? "text-white" : "text-ink")}>{evidence.label}</span>
        <span className={cn("min-w-0 flex-1 truncate font-mono text-[11px]", dark ? "text-fog" : "text-slate")}>{evidence.url.replace(/^https?:\/\//, "")}</span>
        <ChevronDown aria-hidden className={cn("size-3.5 shrink-0 transition-transform duration-200", open && "rotate-180", dark ? "text-fog" : "text-slate")} />
      </button>
      <div id={id} hidden={!open} className="px-3 pb-3">
        <pre
          className={cn(
            "whitespace-pre-wrap break-words rounded-lg px-3 py-2 font-mono text-[11.5px] leading-5",
            dark ? "bg-white/[0.04] text-white/85" : "bg-canvas text-ink",
          )}
        >
          {evidence.excerpt}
        </pre>
        <p className={cn("mt-2 text-[11px]", dark ? "text-fog" : "text-slate")}>
          Collected {formatDate(evidence.collectedAt)} · Sample source on a reserved example domain. Not a live page.
        </p>
      </div>
    </div>
  );
}
