"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { campaignStatusAction, deleteCampaignAction } from "@/server/actions/campaigns";

const btn = "inline-flex size-8 items-center justify-center rounded-lg border border-line text-slate transition-colors hover:bg-canvas hover:text-ink disabled:opacity-50";

/** Open/edit, pause or resume, and delete, right from the campaigns list. */
export function CampaignRowActions({ id, status, name }: { id: string; status: string; name: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Couldn't do that.");
      router.refresh();
    });
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {pending ? <Loader2 aria-hidden className="size-4 animate-spin text-slate" /> : null}
      <Link href={`/app/campaigns/${id}`} className={btn} title="Open and edit" aria-label={`Open and edit ${name}`}>
        <Pencil aria-hidden className="size-4" />
      </Link>
      {status === "running" ? (
        <button type="button" className={btn} title="Pause" aria-label={`Pause ${name}`} disabled={pending} onClick={() => act(() => campaignStatusAction(id, "pause"))}>
          <Pause aria-hidden className="size-4" />
        </button>
      ) : null}
      {status === "paused" ? (
        <button type="button" className={btn} title="Resume" aria-label={`Resume ${name}`} disabled={pending} onClick={() => act(() => campaignStatusAction(id, "resume"))}>
          <Play aria-hidden className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        className={`${btn} hover:border-danger-fg/40 hover:text-danger-fg`}
        title="Delete"
        aria-label={`Delete ${name}`}
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${name}"? Anything not sent yet is stopped. Emails already sent stay in your history and replies stay in the Inbox.`)) act(() => deleteCampaignAction(id));
        }}
      >
        <Trash2 aria-hidden className="size-4" />
      </button>
      {error ? <span className="ml-1 text-xs text-danger-fg">{error}</span> : null}
    </span>
  );
}
