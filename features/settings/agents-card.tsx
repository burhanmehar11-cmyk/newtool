"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { createTokenAction, revokeTokenAction } from "@/server/actions/tokens";
import type { TokenRow } from "@/server/token-store";
import { formatDate } from "@/lib/utils";

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate">{label}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-green hover:bg-mint-soft"
          onClick={() => {
            navigator.clipboard?.writeText(text).then(() => {
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            });
          }}
        >
          {done ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />} {done ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-1 overflow-x-auto rounded-lg border border-line bg-canvas p-3 font-mono text-[11.5px] leading-5 text-ink scrollbar-thin">{text}</pre>
    </div>
  );
}

export function AgentsCard({ tokens, endpoint }: { tokens: TokenRow[]; endpoint: string }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [fresh, setFresh] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const shown = fresh ?? "YOUR_TOKEN";

  return (
    <div className="space-y-4 text-sm">
      <p className="leading-6 text-slate">
        Connect your own AI agent (Claude, Cursor, or any MCP client) to search Google Maps, research leads, write drafts and prepare campaigns in this workspace. It uses your own AI account. Agents can&apos;t send email: you approve every campaign here.
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await createTokenAction(name);
            if (r.ok) {
              setFresh(r.token);
              setName("");
            } else setError(r.error);
            router.refresh();
          });
        }}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="tok-name">New access token</Label>
          <Input id="tok-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude on my laptop" maxLength={60} />
        </div>
        <Button type="submit" variant="secondary" disabled={pending || !name.trim()}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <KeyRound aria-hidden />} Create token
        </Button>
      </form>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      {fresh ? (
        <Callout tone="green" title="Copy your token now">
          It won&apos;t be shown again. Anyone with it can act as you in this workspace (except sending email), so keep it private.
          <span className="mt-2 block break-all rounded-md bg-surface px-2 py-1.5 font-mono text-xs text-ink">{fresh}</span>
        </Callout>
      ) : null}

      {tokens.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{t.name}</span>
                <span className="block text-xs text-slate">
                  <span className="font-mono">{t.prefix}…</span> · created {formatDate(t.created_at)} · {t.last_used_at ? `last used ${formatDate(t.last_used_at)}` : "never used"}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Revoke ${t.name}`}
                onClick={() => {
                  if (confirm(`Revoke “${t.name}”? Agents using it stop working immediately.`)) start(async () => { await revokeTokenAction(t.id); router.refresh(); });
                }}
              >
                <Trash2 aria-hidden /> Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-3">
        <p className="font-medium text-ink">Connect</p>
        <CopyBlock label="Server URL" text={endpoint} />
        <CopyBlock label="Claude Code (terminal)" text={`claude mcp add --transport http locentio ${endpoint} --header "Authorization: Bearer ${shown}"`} />
        <CopyBlock label="Cursor, Windsurf and other clients (mcp.json)" text={JSON.stringify({ mcpServers: { locentio: { url: endpoint, headers: { Authorization: `Bearer ${shown}` } } } }, null, 2)} />
        <CopyBlock
          label="Claude Desktop (claude_desktop_config.json, via mcp-remote)"
          text={JSON.stringify({ mcpServers: { locentio: { command: "npx", args: ["-y", "mcp-remote", endpoint, "--header", `Authorization:Bearer ${shown}`] } } }, null, 2)}
        />
        <FieldHint>Then ask your agent, for example: “Find dentists in Austin on Google Maps, research the best five and draft a first email for each.”</FieldHint>
      </div>
    </div>
  );
}
