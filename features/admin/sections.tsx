import Link from "next/link";
import { CircleCheck, CircleDashed, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/misc";
import { TrendChart } from "@/features/analytics/trend-chart";
import { PlanEditor } from "@/features/admin/plan-editor";
import { Panel, Table, Tiles, delta, num, pct } from "@/features/admin/parts";
import { sourceLabel } from "@/lib/attribution";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { getAdminTab } from "@/server/services/admin";

type Data = Awaited<ReturnType<typeof getAdminTab>>;
type Of<T extends Data["tab"]> = Extract<Data, { tab: T }>;
type Daily = Record<string, string | number>[];

const C1 = "var(--chart-1)";
const C2 = "var(--chart-2)";
const planTone = { trial: "info", free: "outline", paid: "green", comp: "neutral", lapsed: "warn" } as const;
const planLabel = { trial: "Trial", free: "Free", paid: "Paid", comp: "Complimentary", lapsed: "Lapsed" } as const;
const sum = (d: Daily, k: string) => d.reduce((a, r) => a + Number(r[k] ?? 0), 0);
const rows = (d: Daily) => d as ({ day: string } & Record<string, string | number>)[];

function SourcesTable({ sources }: { sources: Of<"funnel">["sources"] }) {
  if (!sources.length) return <p className="px-5 py-6 text-sm text-slate">No visits or sign-ups recorded in this period yet.</p>;
  return (
    <Table caption="Sign-ups by source" minWidth={620} head={["Source", { label: "First visits", right: true }, { label: "Sign-ups", right: true }, { label: "Visit → sign-up", right: true }, { label: "Launched a campaign", right: true }, { label: "Paid", right: true }]}>
      {sources.map((s) => (
        <tr key={s.source}>
          <td className="font-medium text-ink">{sourceLabel(s.source)}</td>
          <td className="text-right tabular-nums">{num(s.visits)}</td>
          <td className="text-right tabular-nums">{num(s.signups)}</td>
          <td className="text-right tabular-nums text-slate">{s.visits ? pct(s.signups, s.visits) : "—"}</td>
          <td className="text-right tabular-nums">{num(s.activated)}</td>
          <td className="text-right tabular-nums text-green">{num(s.paid)}</td>
        </tr>
      ))}
    </Table>
  );
}

export function OverviewTab({ d, days }: { d: Of<"overview">; days: number }) {
  const o = d.overview;
  return (
    <div className="space-y-5">
      <Tiles
        items={[
          { label: "People signed up", value: num(o.users), hint: `${num(o.users7)} in the last 7 days` },
          { label: "Sign-ups, last 30 days", value: num(o.users30), hint: delta(o.users30, o.usersPrev30) },
          { label: "Workspaces", value: num(o.workspaces), hint: `${num(o.active7)} active in the last 7 days` },
          { label: "First visits, last 30 days", value: num(o.visits30), hint: o.visits30 ? `${pct(o.users30, o.visits30)} became sign-ups` : "counted from today on" },
          { label: "On trial", value: num(o.plans.trial), hint: `${o.trialsEndingSoon} ending within 7 days`, tone: o.trialsEndingSoon ? "warn" : undefined },
          { label: "Paid workspaces", value: num(o.plans.paid), hint: `${o.plans.comp} complimentary · ${o.plans.free} free`, tone: "green" },
          { label: "Emails sent, last 30 days", value: num(o.sent30), hint: `${num(o.replies30)} replies` },
          { label: "Searches, last 30 days", value: num(o.searches30), hint: `${num(o.leads30)} leads saved` },
        ]}
      />
      {o.trialsExpired ? (
        <Callout tone="warn" title={`${o.trialsExpired} trial${o.trialsExpired === 1 ? " has" : "s have"} ended`}>
          Nothing is locked yet (plans aren&apos;t enforced until billing exists). <Link href="/admin?tab=workspaces">Review workspaces</Link>.
        </Callout>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Sign-ups and first visits" description={`Per day, last ${days} days`}>
          <TrendChart data={rows(d.daily)} series={[{ key: "visits", label: "First visits", color: C2 }, { key: "signups", label: "Sign-ups", color: C1 }]} />
        </Panel>
        <Panel title="Emails sent and replies" description={`Across all workspaces, last ${days} days`}>
          <TrendChart data={rows(d.daily)} series={[{ key: "sent", label: "Sent", color: C1 }, { key: "replied", label: "Replies", color: C2 }]} />
        </Panel>
      </div>
      <Panel title="Top sign-up sources" description={`Last ${days} days`} flush actions={<Link href={`/admin?tab=funnel&days=${days}`} className="text-sm">Full funnel</Link>}>
        <SourcesTable sources={d.sources} />
      </Panel>
    </div>
  );
}

export function FunnelTab({ d, days }: { d: Of<"funnel">; days: number }) {
  const top = d.funnel.steps[0]?.count ?? 0;
  return (
    <div className="space-y-5">
      <Panel title="Sign-up funnel" description={`People who signed up in the last ${days} days, and how far each got`}>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-slate">
          <span>
            <span className="font-display text-xl font-semibold text-ink">{num(d.funnel.visits)}</span> anonymous first visits
          </span>
          <span>{d.funnel.visits ? `${pct(top, d.funnel.visits)} of visits signed up` : "Visits are counted from the day this panel shipped."}</span>
        </div>
        <ol className="space-y-2.5">
          {d.funnel.steps.map((s, i) => {
            const prev = i ? d.funnel.steps[i - 1].count : s.count;
            return (
              <li key={s.key} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate text-ink">{s.label}</span>
                <span className="h-7 overflow-hidden rounded-md bg-canvas">
                  <span className="block h-full rounded-md bg-[var(--chart-1)]" style={{ width: `${top ? Math.max(1.5, (s.count / top) * 100) : 0}%`, opacity: 0.35 + 0.65 * (top ? s.count / top : 0) }} />
                </span>
                <span className="w-36 text-right tabular-nums text-slate">
                  <span className="font-semibold text-ink">{num(s.count)}</span> · {pct(s.count, top)}
                  {i ? <span className="ml-1 text-xs">({pct(s.count, prev)} of prev)</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </Panel>
      <Panel title="Sources" description="Where people first came from (utm tags or the referring site), next to anonymous first visits from the same source" flush>
        <SourcesTable sources={d.sources} />
      </Panel>
      <Panel title="Campaign links" description="Sign-ups that arrived through a link with utm_campaign" flush>
        {d.campaigns.length ? (
          <Table caption="Campaign links" minWidth={420} head={["Campaign", "Source", { label: "Sign-ups", right: true }]}>
            {d.campaigns.map((c) => (
              <tr key={`${c.campaign}-${c.source}`}>
                <td className="font-mono text-xs text-ink">{c.campaign}</td>
                <td>{sourceLabel(c.source)}</td>
                <td className="text-right tabular-nums">{c.signups}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="px-5 py-6 text-sm text-slate">
            None yet. Add <code className="font-mono">?utm_source=…&amp;utm_campaign=…</code> to links you share to see them here.
          </p>
        )}
      </Panel>
    </div>
  );
}

function SearchForm({ tab, search, placeholder }: { tab: string; search: string; placeholder: string }) {
  return (
    <form method="get" action="/admin" className="flex gap-2">
      <input type="hidden" name="tab" value={tab} />
      <input name="q" defaultValue={search} placeholder={placeholder} aria-label={placeholder} className="h-9 w-56 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-slate/70" />
      <button className="h-9 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-canvas">Search</button>
    </form>
  );
}

export function UsersTab({ d, search }: { d: Of<"users">; search: string }) {
  return (
    <Panel title="People" description={`${d.users.length === 200 ? "Newest 200" : d.users.length} account${d.users.length === 1 ? "" : "s"}${search ? ` matching “${search}”` : ""}`} flush actions={<SearchForm tab="users" search={search} placeholder="Email or name" />}>
      <Table caption="People" minWidth={980} head={["Person", "Sign-in", "Source", "Workspace", "Plan", "Joined", "Last sign-in"]}>
        {d.users.map((u) => (
          <tr key={u.id}>
            <td className="max-w-[260px]">
              <span className="block truncate font-medium text-ink">{u.email ?? "No email"}</span>
              {u.name ? <span className="block truncate text-xs text-slate">{u.name}</span> : null}
            </td>
            <td>
              <span className="text-xs text-slate">{u.method === "google" ? "Google" : "Password"}</span>
              {!u.verified ? (
                <Badge tone="warn" className="ml-1.5">
                  Unconfirmed
                </Badge>
              ) : null}
            </td>
            <td className="text-xs">
              {u.source ? sourceLabel(u.source) : <span className="text-slate">Unknown</span>}
              {u.campaign ? <span className="block font-mono text-[11px] text-slate">{u.campaign}</span> : null}
            </td>
            <td className="max-w-[200px] text-xs">
              <span className="block truncate text-ink">{u.workspace_name ?? <span className="text-slate">None yet</span>}</span>
              {u.role ? (
                <span className="capitalize text-slate">
                  {u.role}
                  {u.workspaces > 1 ? ` · ${u.workspaces} workspaces` : ""}
                </span>
              ) : null}
            </td>
            <td>{u.plan ? <Badge tone={planTone[u.plan]}>{planLabel[u.plan]}</Badge> : <span className="text-xs text-slate">—</span>}</td>
            <td className="whitespace-nowrap text-xs text-slate">{formatDate(u.created_at)}</td>
            <td className="whitespace-nowrap text-xs text-slate">{u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "Never"}</td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}

export function WorkspacesTab({ d, search }: { d: Of<"workspaces">; search: string }) {
  return (
    <Panel
      title="Workspaces and plans"
      description={`Plans are set by hand until billing exists and aren't enforced. Trials default to ${d.trial} days (TRIAL_DAYS). Every change is logged.`}
      flush
      actions={<SearchForm tab="workspaces" search={search} placeholder="Workspace or member email" />}
    >
      <Table caption="Workspaces" minWidth={1040} head={["Workspace", "Plan", "Members", { label: "Leads", right: true }, { label: "Emails sent", right: true }, "Mailbox", "Last active", "Created"]}>
        {d.workspaces.map((w) => {
          const left = w.trial_days_left;
          return (
            <tr key={w.id} className="align-top">
              <td className="max-w-[240px]">
                <span className="block truncate font-medium text-ink">{w.name}</span>
                <span className="block truncate text-xs text-slate">{w.owner_email ?? "No owner"}</span>
              </td>
              <td className="min-w-[160px]">
                <Badge tone={planTone[w.plan]}>{planLabel[w.plan]}</Badge>
                {w.plan === "trial" ? <span className={`ml-1.5 text-xs ${left < 0 ? "text-danger-fg" : left <= 7 ? "text-warn-fg" : "text-slate"}`}>{left < 0 ? `ended ${-left}d ago` : `${left}d left`}</span> : null}
                {w.plan_note ? <span className="mt-0.5 block max-w-[200px] truncate text-xs text-slate">{w.plan_note}</span> : null}
                <div className="mt-1">
                  <PlanEditor workspaceId={w.id} plan={w.plan} trialEndsAt={new Date(w.trial_ends_at).toISOString()} note={w.plan_note} />
                </div>
              </td>
              <td className="tabular-nums">{w.members}</td>
              <td className="text-right tabular-nums">{num(w.leads)}</td>
              <td className="text-right tabular-nums">{num(w.sent)}</td>
              <td className="text-xs">{w.mailboxes ? <span className="text-green">Connected</span> : <span className="text-slate">None</span>}</td>
              <td className="whitespace-nowrap text-xs text-slate">{w.last_active ? formatDate(w.last_active) : "—"}</td>
              <td className="whitespace-nowrap text-xs text-slate">{formatDate(w.created_at)}</td>
            </tr>
          );
        })}
      </Table>
    </Panel>
  );
}

export function UsageTab({ d, days }: { d: Of<"usage">; days: number }) {
  const r = rows(d.daily);
  return (
    <div className="space-y-5">
      <Tiles
        items={[
          { label: `Searches, ${days} days`, value: num(sum(d.daily, "searches")) },
          { label: `Leads saved, ${days} days`, value: num(sum(d.daily, "leads")) },
          { label: `Websites researched, ${days} days`, value: num(sum(d.daily, "research")) },
          { label: `AI-written drafts, ${days} days`, value: num(sum(d.daily, "ai_drafts")), hint: "built-in writer and agents" },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Searches and leads saved" description="Per day, all workspaces">
          <TrendChart data={r} series={[{ key: "searches", label: "Searches", color: C2 }, { key: "leads", label: "Leads saved", color: C1 }]} />
        </Panel>
        <Panel title="Research and AI drafts" description="Per day, all workspaces">
          <TrendChart data={r} series={[{ key: "research", label: "Researched", color: C1 }, { key: "ai_drafts", label: "AI drafts", color: C2 }]} />
        </Panel>
      </div>
    </div>
  );
}

export function EmailsTab({ d, days }: { d: Of<"emails">; days: number }) {
  const s = d.stats;
  return (
    <div className="space-y-5">
      <Tiles
        items={[
          { label: `Emails sent, ${days} days`, value: num(s.sent), hint: `${num(s.followups)} were follow-ups` },
          { label: "Replies", value: num(s.replies), hint: `${pct(s.replies, s.sent)} of sent · ${num(s.interested)} interested` },
          { label: "Bounces and unsubscribes", value: num(s.bounces + s.unsubscribes), hint: `${num(s.bounces)} bounced · ${num(s.unsubscribes)} unsubscribed`, tone: s.sent && (s.bounces + s.unsubscribes) / s.sent > 0.05 ? "warn" : undefined },
          { label: "Failed sends", value: num(s.failed), hint: "rejected or unclear", tone: s.failed ? "warn" : undefined },
          { label: "Connected mailboxes", value: num(s.mailboxes), hint: s.reconnect ? `${s.reconnect} need reconnecting` : "all healthy", tone: s.reconnect ? "warn" : undefined },
          { label: "Running campaigns", value: num(s.running) },
          { label: "Account emails", value: d.channel.kind === "none" ? "Off" : "On", hint: d.channel.kind === "smtp" ? "sent over SMTP" : d.channel.kind === "gmail" ? `sent from ${d.channel.email}` : "connect your Gmail or set SMTP_URL", tone: d.channel.kind === "none" ? "warn" : undefined },
        ]}
      />
      <Panel title="Emails sent and replies" description={`Per day, last ${days} days`}>
        <TrendChart data={rows(d.daily)} series={[{ key: "sent", label: "Sent", color: C1 }, { key: "replied", label: "Replies", color: C2 }]} />
      </Panel>
      <Panel title="Mailboxes needing attention" flush>
        {d.problems.length ? (
          <Table caption="Mailboxes needing attention" minWidth={620} head={["Mailbox", "Workspace", "Status", "Last error"]}>
            {d.problems.map((m) => (
              <tr key={`${m.workspace}-${m.email}`}>
                <td className="font-mono text-xs text-ink">{m.email}</td>
                <td>{m.workspace}</td>
                <td>
                  <Badge tone="warn">{m.status.replace("_", " ")}</Badge>
                </td>
                <td className="max-w-[320px] truncate text-xs text-slate">{m.last_error ?? "—"}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="px-5 py-6 text-sm text-slate">Every connected mailbox is working.</p>
        )}
      </Panel>
    </div>
  );
}

function Status({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {on ? <CircleCheck aria-hidden className="size-4 text-green" /> : <CircleDashed aria-hidden className="size-4 text-slate" />} {label}
    </span>
  );
}

export function ApisTab({ d, days }: { d: Of<"apis">; days: number }) {
  const today = d.apis.places.at(-1)?.calls ?? 0;
  const merged = d.apis.places.map((p, i) => ({ day: p.day, calls: p.calls, units: d.apis.ai[i]?.units ?? 0 }));
  return (
    <div className="space-y-5">
      <Tiles
        items={[
          { label: "Google Maps searches today", value: d.placesLimit === null ? num(today) : `${num(today)} / ${num(d.placesLimit)}`, hint: d.placesLimit === null ? "no Locenti cap; Google's quota applies" : "Locenti cap (GOOGLE_PLACES_DAILY_LIMIT)", tone: d.placesLimit !== null && today >= d.placesLimit ? "warn" : undefined },
          { label: `Google Maps searches, ${days} days`, value: num(d.apis.places.reduce((a, p) => a + p.calls, 0)) },
          { label: `Built-in AI units, ${days} days`, value: num(d.apis.ai.reduce((a, p) => a + p.units, 0)), hint: "Gemini, shared key" },
          { label: "Agent (MCP) tokens", value: num(d.apis.tokens.active), hint: `${d.apis.tokens.used7} used this week · ${d.apis.tokens.workspaces} workspaces` },
        ]}
      />
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-5 py-3">
        <Status on={d.placesOn} label="Google Places API key" />
        <Status on={d.aiOn} label="Gemini API key" />
        <Status on label="MCP server (/api/mcp)" />
      </div>
      <Panel title="Shared key usage" description={`Google Maps searches and built-in AI units per day, last ${days} days`}>
        <TrendChart data={merged} series={[{ key: "calls", label: "Google Maps searches", color: C1 }, { key: "units", label: "AI units", color: C2 }]} />
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Agent tokens" description="Most recently used personal tokens (bring-your-own AI over MCP)" flush>
          {d.apis.recentTokens.length ? (
            <Table caption="Agent tokens" minWidth={520} head={["Token", "Workspace", "Owner", "Last used"]}>
              {d.apis.recentTokens.map((t) => (
                <tr key={`${t.prefix}-${t.created_at}`}>
                  <td>
                    <span className="block text-ink">{t.name}</span>
                    <span className="font-mono text-[11px] text-slate">{t.prefix}…</span>
                  </td>
                  <td className="text-xs">{t.workspace}</td>
                  <td className="text-xs text-slate">{t.email ?? "—"}</td>
                  <td className="whitespace-nowrap text-xs text-slate">{t.last_used_at ? formatDateTime(t.last_used_at) : "Never"}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="px-5 py-6 text-sm text-slate">No agent tokens yet.</p>
          )}
        </Panel>
        <Panel title="Biggest AI users" description={`Built-in AI units by workspace, last ${days} days`} flush>
          {d.apis.topAi.length ? (
            <Table caption="AI units by workspace" minWidth={320} head={["Workspace", { label: "Units", right: true }]}>
              {d.apis.topAi.map((t) => (
                <tr key={t.workspace}>
                  <td>{t.workspace}</td>
                  <td className="text-right tabular-nums">{num(t.units)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="px-5 py-6 text-sm text-slate">No built-in AI use in this period.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

const money = (minor: number, currency: string) => {
  try {
    return (minor / 100).toLocaleString("en-US", { style: "currency", currency });
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
};

export function RevenueTab({ d, days }: { d: Of<"revenue">; days: number }) {
  const o = d.overview;
  const b = d.billing;
  const hasPayments = b.ready && b.byCurrency.length > 0;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-5 py-3">
        <Status on={d.configured.checkout} label="Paddle checkout (client token + price ids)" />
        <Status on={d.configured.webhook} label="Paddle webhook secret" />
        <Status on={d.configured.environment === "production"} label={d.configured.environment === "production" ? "Live payments" : "Sandbox (test) payments"} />
        <Status on={d.configured.enforce} label="Plan limits enforced (BILLING_ENFORCE)" />
      </div>
      {!b.ready ? (
        <Callout tone="warn" title="Run migration 0014_billing.sql">Billing tables aren&apos;t in the database yet.</Callout>
      ) : !hasPayments ? (
        <Callout tone="info" title="No payments yet">
          Revenue appears here from real Paddle payments as soon as the first one arrives. Until then, plans can still be set by hand on the Workspaces tab.
        </Callout>
      ) : null}
      {b.ready ? (
        <Tiles
          items={[
            ...b.byCurrency.map((c) => ({ label: `Revenue, ${days} days (${c.currency})`, value: money(c.period, c.currency), hint: `${c.payments} payment${c.payments === 1 ? "" : "s"} · ${money(c.allTime, c.currency)} all time`, tone: "green" as const })),
            ...(b.mrr.length ? b.mrr.map((m) => ({ label: `Monthly recurring (${m.currency})`, value: money(m.amount, m.currency), hint: "last payment of each active subscription" })) : [{ label: "Monthly recurring", value: "—", hint: "no active subscriptions" }]),
            { label: "Active subscriptions", value: num(b.subs.active), hint: `${b.subs.trialing} trialing · ${b.subs.past_due} payment failed`, tone: b.subs.past_due ? ("warn" as const) : undefined },
            { label: `Cancelled, ${days} days`, value: num(b.subs.canceled_period) },
            { label: "On trial (Locenti)", value: num(o.plans.trial), hint: `${o.trialsEndingSoon} ending within 7 days · ${o.trialsExpired} ended` },
            { label: "Lapsed", value: num(o.plans.lapsed), hint: "subscription ended" },
          ]}
        />
      ) : null}
      {b.ready && b.byPlan.length ? (
        <Panel title="Subscriptions by plan" flush>
          <Table caption="Subscriptions by plan" minWidth={320} head={["Plan", { label: "Active", right: true }]}>
            {b.byPlan.map((p) => (
              <tr key={p.plan_id ?? "unknown"}>
                <td className="capitalize">{p.plan_id ?? "Unknown price"}</td>
                <td className="text-right tabular-nums">{p.n}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      ) : null}
      {b.ready && b.recent.length ? (
        <Panel title="Recent billing events" description="As received from Paddle" flush>
          <Table caption="Recent billing events" minWidth={560} head={["When", "Event", "Workspace", { label: "Amount", right: true }]}>
            {b.recent.map((e, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap text-xs text-slate">{formatDateTime(e.received_at)}</td>
                <td className="font-mono text-xs">{e.type}</td>
                <td className="text-xs">{e.workspace ?? <span className="text-slate">Unmatched</span>}</td>
                <td className="text-right tabular-nums">{e.amount_minor !== null && e.currency ? money(e.amount_minor, e.currency) : "—"}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      ) : null}
      <Panel title="Paid and complimentary workspaces" flush>
        {d.paying.length ? (
          <Table caption="Paid and complimentary workspaces" minWidth={560} head={["Workspace", "Owner", "Plan", "Note", "Since"]}>
            {d.paying.map((w) => (
              <tr key={w.id}>
                <td className="font-medium text-ink">{w.name}</td>
                <td className="text-xs text-slate">{w.owner_email ?? "—"}</td>
                <td>
                  <Badge tone={planTone[w.plan]}>{planLabel[w.plan]}</Badge>
                </td>
                <td className="max-w-[240px] truncate text-xs text-slate">{w.plan_note ?? "—"}</td>
                <td className="whitespace-nowrap text-xs text-slate">{formatDate(w.created_at)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="flex items-center gap-2 px-5 py-6 text-sm text-slate">
            <CreditCard aria-hidden className="size-4" /> No paid or complimentary workspaces yet.
          </p>
        )}
      </Panel>
    </div>
  );
}

export function AdminsTab({ d }: { d: Of<"admins"> }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Panel title="Platform admins" description="People in ADMIN_EMAILS. Change the list in Vercel → Settings → Environment Variables, then redeploy." flush>
        <ul className="divide-y divide-line">
          {d.admins.map((a) => (
            <li key={a.email} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{a.email}</span>
                <span className="text-xs text-slate">{a.hasAccount ? (a.lastSignIn ? `Last signed in ${formatDateTime(a.lastSignIn)}` : "Has an account") : "No account yet"}</span>
              </span>
              <Badge tone="green">Admin</Badge>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Admin activity" description="Every plan change made from this panel" flush>
        {d.audit.length ? (
          <Table caption="Admin activity" minWidth={560} head={["When", "Admin", "Action", "Details"]}>
            {d.audit.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-xs text-slate">{formatDateTime(a.created_at)}</td>
                <td className="text-xs">{a.admin_email}</td>
                <td className="text-xs">
                  {a.action === "set_plan" ? "Changed plan" : a.action} · <span className="text-ink">{a.target}</span>
                </td>
                <td className="text-xs text-slate">
                  {a.action === "set_plan" ? `${String(a.details.from)} → ${String(a.details.to)}${a.details.note ? ` (${String(a.details.note)})` : ""}` : JSON.stringify(a.details)}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="px-5 py-6 text-sm text-slate">No admin changes yet.</p>
        )}
      </Panel>
    </div>
  );
}
