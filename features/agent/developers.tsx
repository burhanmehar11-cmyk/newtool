"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Braces, Check, Copy, Send, Trash2, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldError, Input, Label } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { EVENT_INFO, WEBHOOK_EVENTS } from "@/lib/webhooks";
import { createWebhookAction, removeWebhookAction, testWebhookAction, toggleWebhookAction } from "@/server/actions/webhooks";
import type { DeliveryRow, EndpointRow } from "@/server/webhook-store";
import { formatDateTime } from "@/lib/utils";

function Copyable({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-canvas"
    >
      {done ? <Check aria-hidden className="size-3.5 text-green" /> : <Copy aria-hidden className="size-3.5" />} {done ? "Copied" : label}
    </button>
  );
}

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/api/v1/workspace", "Your workspace, offer and connected mailboxes"],
  ["POST", "/api/v1/search", "Search Google Maps (business_type, place, state, country, min_rating, website, max_results)"],
  ["GET", "/api/v1/leads?limit=50", "Saved leads with website, public email and status"],
  ["POST", "/api/v1/leads", "Save Google Maps results as leads (items: [{place_id, website}])"],
  ["GET", "/api/v1/leads/{id}", "A lead with its Opportunity Brief, sources and latest draft"],
  ["POST", "/api/v1/leads/{id}/research", "Read the lead's website and build its brief"],
  ["POST", "/api/v1/leads/{id}/drafts", "Save a first email draft (subject, body)"],
  ["GET", "/api/v1/campaigns", "Campaigns with counts"],
  ["POST", "/api/v1/campaigns", "Create a draft campaign for people to review (name, lead_ids)"],
  ["GET", "/api/v1/campaigns/{id}", "Each recipient's state and reply label"],
  ["GET", "/api/v1/replies?label=interested", "Replies with their labels, newest first"],
];

export function ApiReference({ base }: { base: string }) {
  const curl = `curl ${base}/api/v1/leads?limit=5 \\\n  -H "Authorization: Bearer loc_your_token"`;
  return (
    <section id="api" className="card scroll-mt-6 p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-green">
          <Braces aria-hidden className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">REST API</h2>
          <p className="mt-0.5 text-sm text-slate">The same actions as the agent tools, over plain HTTPS with JSON. Use a personal token from above. Approving and sending stay in Locenti.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-midnight p-4 font-mono text-[13px] leading-6 text-white/90 scrollbar-thin">{curl}</pre>
        <Copyable text={curl} />
      </div>
      <div className="mt-5 overflow-x-auto rounded-xl border border-line scrollbar-thin">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">API endpoints</caption>
          <tbody className="divide-y divide-line">
            {ENDPOINTS.map(([m, path, what]) => (
              <tr key={`${m} ${path}`}>
                <td className="w-16 py-2.5 pl-4">
                  <Badge tone={m === "GET" ? "info" : "green"}>{m}</Badge>
                </td>
                <td className="py-2.5 pr-3 font-mono text-[13px] text-ink">{path}</td>
                <td className="py-2.5 pr-4 text-[13px] text-slate">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate">
        Errors come back as <code className="font-mono">{"{ \"error\": { \"code\", \"message\" } }"}</code> with status 400, 401, 403, 404, 413 or 429. Searches and AI writing count against the same daily limits as the app.
      </p>
    </section>
  );
}

type Hooks = { allowed: false } | { allowed: true; ready: boolean; endpoints: EndpointRow[]; deliveries: DeliveryRow[]; keyOk: boolean };

export function WebhooksSection({ hooks }: { hooks: Hooks }) {
  const router = useRouter();
  const [url, setUrl] = React.useState("");
  const [events, setEvents] = React.useState<string[]>(["reply.received"]);
  const [error, setError] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = React.useTransition();
  const run = (fn: () => Promise<void>) => start(async () => {
    await fn();
    router.refresh();
  });

  return (
    <section id="webhooks" className="card scroll-mt-6 p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-green">
          <Webhook aria-hidden className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Webhooks</h2>
          <p className="mt-0.5 text-sm text-slate">Locenti POSTs signed JSON to your URL when something happens, so your CRM, Zapier-style tools or scripts stay in sync.</p>
        </div>
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {WEBHOOK_EVENTS.map((e) => (
          <li key={e} className="rounded-xl border border-line p-3">
            <p className="font-mono text-[13px] font-medium text-ink">{e}</p>
            <p className="mt-0.5 text-xs text-slate">{EVENT_INFO[e]}</p>
          </li>
        ))}
      </ul>

      {!hooks.allowed ? (
        <Callout tone="info" className="mt-5">Only workspace owners and admins can add webhooks.</Callout>
      ) : !hooks.ready ? (
        <Callout tone="warn" className="mt-5" title="One step left">Run <code className="font-mono">database/migrations/0012_webhooks.sql</code> in Neon to turn webhooks on.</Callout>
      ) : (
        <>
          <form
            className="mt-6 space-y-3 border-t border-line pt-6"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              setSecret(null);
              run(async () => {
                const r = await createWebhookAction({ url, events });
                if (r.ok) {
                  setSecret(r.secret);
                  setUrl("");
                } else setError(r.error);
              });
            }}
          >
            <div>
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input id="wh-url" type="url" required placeholder="https://example.com/hooks/locenti" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Events</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {WEBHOOK_EVENTS.map((e) => (
                  <label key={e} className="inline-flex items-center gap-2 text-sm text-ink">
                    <Checkbox checked={events.includes(e)} onChange={(x) => setEvents((s) => (x.target.checked ? [...s, e] : s.filter((y) => y !== e)))} />
                    <span className="font-mono text-[13px]">{e}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {error ? <FieldError>{error}</FieldError> : null}
            <Button type="submit" size="sm" disabled={pending || !url || !events.length}>
              Add endpoint
            </Button>
          </form>

          {secret ? (
            <Callout tone="green" className="mt-4" title="Signing secret (shown once)">
              <p className="mb-2">Store it with your receiver. Each request has a <code className="font-mono">Locenti-Signature: t=…,v1=…</code> header: the hex HMAC-SHA256 of <code className="font-mono">{"`${t}.${rawBody}`"}</code> with this secret. Reject requests older than 5 minutes.</p>
              <div className="flex flex-wrap gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs text-ink">{secret}</code>
                <Copyable text={secret} label="Copy secret" />
              </div>
            </Callout>
          ) : null}
          {note ? (
            <Callout tone={note.ok ? "green" : "warn"} className="mt-4">
              <span role="status">{note.text}</span>
            </Callout>
          ) : null}

          {hooks.endpoints.length ? (
            <ul className="mt-6 divide-y divide-line rounded-xl border border-line">
              {hooks.endpoints.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[13px] text-ink">{e.url}</span>
                    <span className="block text-xs text-slate">
                      {e.events.join(", ")} · secret {e.secret_prefix}…{e.last_status ? ` · ${e.last_status}` : ""}
                    </span>
                    {e.disabled_at ? <span className="block text-xs text-warn-fg">Off{e.disabled_reason ? `: ${e.disabled_reason}` : ""}</span> : null}
                  </span>
                  <Button size="sm" variant="secondary" disabled={pending || !!e.disabled_at} onClick={() => run(async () => setNote(await testWebhookAction(e.id).then((r) => ({ ok: r.ok, text: r.message }))))}>
                    <Send aria-hidden /> Send test
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(async () => void (await toggleWebhookAction(e.id, !!e.disabled_at)))}>
                    {e.disabled_at ? "Turn on" : "Turn off"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${e.url}`}
                    disabled={pending}
                    onClick={() => {
                      if (confirm("Delete this endpoint? Pending deliveries to it are dropped.")) run(async () => void (await removeWebhookAction(e.id)));
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {hooks.deliveries.length ? (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-ink">Recent deliveries</h3>
              <ul className="divide-y divide-line rounded-xl border border-line text-[13px]">
                {hooks.deliveries.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <Badge tone={d.status === "delivered" ? "green" : d.status === "failed" ? "danger" : "warn"}>{d.status}</Badge>
                    <span className="font-mono text-ink">{d.event}</span>
                    <span className="text-slate">{formatDateTime(d.created_at)}</span>
                    <span className="text-slate">
                      {d.attempts} attempt{d.attempts === 1 ? "" : "s"}
                      {d.last_status ? ` · HTTP ${d.last_status}` : ""}
                    </span>
                    {d.last_error && d.status !== "delivered" ? <span className="w-full truncate text-xs text-danger-fg">{d.last_error}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-4 text-xs leading-5 text-slate">
            Failed deliveries are retried after 1 min, 5 min, 30 min, 2 h and 6 h; an endpoint that keeps failing is switched off. Deliveries go out every minute while Locenti is open, and with the optional scheduler.
          </p>
        </>
      )}
    </section>
  );
}
