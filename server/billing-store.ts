import type { Q } from "@/server/auth-store";
import { planForStatus, type BillingEvent } from "@/lib/billing/paddle";

/** Billing records. Service connection only. */

/** Stores a provider event once. False when it was already stored (a retry), so callers apply it only once. */
export async function recordEvent(q: Q, provider: string, ev: BillingEvent, workspaceId: string | null, payload: unknown): Promise<boolean> {
  const r = await q.query(
    `insert into app.billing_events (provider, event_id, type, workspace_id, occurred_at, amount_minor, currency, payload)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) on conflict (provider, event_id) do nothing returning event_id`,
    [provider, ev.eventId, ev.type, workspaceId, ev.occurredAt, ev.payment?.amountMinor ?? null, ev.payment?.currency?.toUpperCase() ?? null, JSON.stringify(payload)],
  );
  return r.rows.length > 0;
}

export async function workspaceForSubscription(q: Q, subscriptionId: string): Promise<string | null> {
  return (await q.query<{ workspace_id: string }>("select workspace_id from app.billing_accounts where subscription_id = $1", [subscriptionId])).rows[0]?.workspace_id ?? null;
}

export async function workspaceExists(q: Q, id: string): Promise<boolean> {
  return (await q.query("select 1 from public.workspaces where id = $1", [id])).rows.length > 0;
}

/** Saves the subscription's state and moves the workspace's plan with it (a complimentary plan set by an admin stays). */
export async function applySubscription(q: Q, ws: string, provider: string, s: NonNullable<BillingEvent["subscription"]>, planId: string | null) {
  await q.query(
    `insert into app.billing_accounts (workspace_id, provider, customer_id, subscription_id, status, plan_id, price_id, period_ends_at, cancel_at, manage_url, cancel_url, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
     on conflict (workspace_id) do update set provider = excluded.provider, customer_id = coalesce(excluded.customer_id, app.billing_accounts.customer_id),
       subscription_id = excluded.subscription_id, status = excluded.status, plan_id = coalesce(excluded.plan_id, app.billing_accounts.plan_id),
       price_id = coalesce(excluded.price_id, app.billing_accounts.price_id), period_ends_at = excluded.period_ends_at, cancel_at = excluded.cancel_at,
       manage_url = coalesce(excluded.manage_url, app.billing_accounts.manage_url), cancel_url = coalesce(excluded.cancel_url, app.billing_accounts.cancel_url), updated_at = now()`,
    [ws, provider, s.customerId, s.id, s.status, planId, s.priceId, s.periodEndsAt, s.cancelAt, s.manageUrl, s.cancelUrl],
  );
  await q.query("update public.workspaces set plan = $2, plan_updated_at = now() where id = $1 and plan <> 'comp'", [ws, planForStatus(s.status)]);
}

/** Adds a paid month's units to the workspace (unused units roll over). */
export async function grantUnits(q: Q, ws: string, grant: { discovery: number; verification: number; ai: number }) {
  for (const [kind, units] of Object.entries(grant)) {
    await q.query(
      `insert into public.workspace_allowances (workspace_id, kind, units) values ($1, $2, $3)
       on conflict (workspace_id, kind) do update set units = public.workspace_allowances.units + excluded.units`,
      [ws, kind, units],
    );
  }
}

export type BillingAccount = {
  status: string | null;
  plan_id: string | null;
  period_ends_at: string | null;
  cancel_at: string | null;
  manage_url: string | null;
  cancel_url: string | null;
  updated_at: string;
};

export async function getAccount(q: Q, ws: string): Promise<BillingAccount | null> {
  return (await q.query<BillingAccount>("select status, plan_id, period_ends_at, cancel_at, manage_url, cancel_url, updated_at from app.billing_accounts where workspace_id = $1", [ws])).rows[0] ?? null;
}

/** Revenue from stored payments only. Amounts are in each currency's minor unit. */
export async function revenue(q: Q, days: number) {
  const byCurrency = (
    await q.query<{ currency: string; period: string; all_time: string; payments: number }>(
      `select currency, coalesce(sum(amount_minor) filter (where received_at > now() - make_interval(days => $1::int)), 0) as period,
         coalesce(sum(amount_minor), 0) as all_time, count(*) filter (where received_at > now() - make_interval(days => $1::int))::int as payments
       from app.billing_events where amount_minor is not null and currency is not null group by currency order by currency`,
      [days],
    )
  ).rows.map((r) => ({ currency: r.currency, period: Number(r.period), allTime: Number(r.all_time), payments: r.payments }));
  // Monthly recurring: the last payment of each active subscription.
  const mrr = (
    await q.query<{ currency: string; amount: string }>(
      `select e.currency, sum(e.amount_minor) as amount from app.billing_accounts a
       join lateral (select currency, amount_minor from app.billing_events x where x.workspace_id = a.workspace_id and x.amount_minor is not null order by x.received_at desc limit 1) e on true
       where a.status in ('active', 'past_due') group by e.currency`,
    )
  ).rows.map((r) => ({ currency: r.currency, amount: Number(r.amount) }));
  const s = (
    await q.query<{ active: number; trialing: number; past_due: number; canceled_period: number }>(
      `select count(*) filter (where status = 'active')::int as active, count(*) filter (where status = 'trialing')::int as trialing,
         count(*) filter (where status = 'past_due')::int as past_due,
         count(*) filter (where status = 'canceled' and updated_at > now() - make_interval(days => $1::int))::int as canceled_period
       from app.billing_accounts`,
      [days],
    )
  ).rows[0];
  const byPlan = (await q.query<{ plan_id: string | null; n: number }>("select plan_id, count(*)::int as n from app.billing_accounts where status in ('active', 'trialing', 'past_due') group by plan_id order by n desc")).rows;
  const recent = (
    await q.query<{ type: string; amount_minor: string | null; currency: string | null; workspace: string | null; received_at: string }>(
      `select e.type, e.amount_minor, e.currency, w.name as workspace, e.received_at from app.billing_events e left join public.workspaces w on w.id = e.workspace_id
       order by e.received_at desc limit 20`,
    )
  ).rows.map((r) => ({ ...r, amount_minor: r.amount_minor === null ? null : Number(r.amount_minor) }));
  return { byCurrency, mrr, subs: s, byPlan, recent };
}
