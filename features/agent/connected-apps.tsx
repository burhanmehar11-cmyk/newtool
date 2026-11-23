"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, PlugZap, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { disconnectAppAction } from "@/server/actions/agent-apps";
import type { ConnectedApp } from "@/server/services/oauth";

/**
 * AI apps that connect with a sign-in (OAuth) instead of a pasted token:
 * ChatGPT, Claude.ai and any MCP client that supports it. Shows how to
 * connect, and the apps connected to this workspace with Disconnect.
 */
export function ConnectedApps({ endpoint, apps }: { endpoint: string; apps: ConnectedApp[] }) {
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-green">Sign in from your AI app</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-ink">ChatGPT, Claude and other AI apps</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate">No token to copy: add Locenti in the app, sign in to Locenti when it asks, pick a workspace and press Allow. The app can find, research and write drafts; only you can approve and send.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-canvas/70 p-3">
        <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{endpoint}</code>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(endpoint);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy URL"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-line p-4 text-sm">
          <p className="font-semibold text-ink">ChatGPT</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate">
            <li>Settings → Apps (or Connectors) → Advanced → turn on Developer mode.</li>
            <li>Create / Add app → name “Locenti”, paste the URL above, authentication OAuth.</li>
            <li>Sign in to Locenti in the window that opens, pick a workspace, press Allow.</li>
          </ol>
        </div>
        <div className="rounded-2xl border border-line p-4 text-sm">
          <p className="font-semibold text-ink">Claude (claude.ai or desktop)</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate">
            <li>Settings → Connectors → Add custom connector.</li>
            <li>Name “Locenti”, paste the URL above, then Connect.</li>
            <li>Sign in to Locenti, pick a workspace, press Allow.</li>
          </ol>
        </div>
      </div>

      <div className="mt-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <PlugZap aria-hidden className="size-4 text-green" /> Connected apps
        </p>
        {apps.length ? (
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
            {apps.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{a.name}</span>
                  <span className="block text-xs text-slate">
                    Connected {formatDateTime(a.created_at)} UTC · {a.last_used_at ? `last used ${formatDateTime(a.last_used_at)} UTC` : "not used yet"}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === a.id}
                  onClick={async () => {
                    if (!confirm(`Disconnect ${a.name}? It loses access to this workspace right away.`)) return;
                    setBusy(a.id);
                    await disconnectAppAction(a.id);
                    setBusy(null);
                    router.refresh();
                  }}
                >
                  {busy === a.id ? <Loader2 aria-hidden className="animate-spin" /> : <Unplug aria-hidden />} Disconnect
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate">No apps connected yet.</p>
        )}
      </div>
    </section>
  );
}
