"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { addDoNotContactAction, removeDoNotContactAction } from "@/server/actions/campaigns";
import type { SuppressionRow } from "@/server/campaign-store";

export function DoNotContact({ entries, canManage }: { entries: SuppressionRow[]; canManage: boolean }) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await addDoNotContactAction(value);
            if (r.ok) setValue("");
            else setError(r.error);
            router.refresh();
          });
        }}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="dnc">Add an email or a whole domain</Label>
          <Input id="dnc" value={value} onChange={(e) => setValue(e.target.value)} placeholder="owner@clinic.com or clinic.com" />
        </div>
        <Button type="submit" variant="secondary" disabled={pending || value.trim().length < 3}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : null} Add
        </Button>
      </form>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      {entries.length ? (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line scrollbar-thin">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{e.value}</span>
              <Badge tone={e.reason === "unsubscribe" ? "warn" : "neutral"}>{e.reason === "unsubscribe" ? "Unsubscribed" : e.kind === "domain" ? "Domain" : "Manual"}</Badge>
              {canManage && e.reason === "manual" ? (
                <button
                  type="button"
                  aria-label={`Remove ${e.value}`}
                  className="rounded p-1 text-slate hover:bg-canvas hover:text-ink"
                  onClick={() => start(async () => { await removeDoNotContactAction(e.id); router.refresh(); })}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate">Nobody yet. People who click unsubscribe are added automatically and are never emailed again from this workspace.</p>
      )}
    </div>
  );
}
