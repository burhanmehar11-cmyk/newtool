import type { Q } from "@/server/auth-store";
import { DISABLE_AFTER, MAX_ATTEMPTS, RETRY_DELAYS_S } from "@/lib/webhooks";

/** Webhook endpoints and the delivery queue. Service connection only; callers scope by workspace. */

export type EndpointRow = {
  id: string;
  url: string;
  events: string[];
  secret_prefix: string;
  created_at: string;
  disabled_at: string | null;
  disabled_reason: string | null;
  failures: number;
  last_delivery_at: string | null;
  last_status: string | null;
};
const COLS = "id, url, events, secret_prefix, created_at, disabled_at, disabled_reason, failures, last_delivery_at, last_status";

export async function insertEndpoint(q: Q, ws: string, userId: string, url: string, events: string[], secretEnc: Buffer, prefix: string): Promise<string> {
  return (
    await q.query<{ id: string }>(
      "insert into public.webhook_endpoints (workspace_id, url, events, secret_enc, secret_prefix, created_by) values ($1, $2, $3::text[], $4, $5, $6) returning id",
      [ws, url, events, secretEnc, prefix, userId],
    )
  ).rows[0].id;
}

export async function countEndpoints(q: Q, ws: string): Promise<number> {
  return Number((await q.query<{ n: string }>("select count(*) as n from public.webhook_endpoints where workspace_id = $1", [ws])).rows[0].n);
}

export async function listEndpoints(q: Q, ws: string): Promise<EndpointRow[]> {
  return (await q.query<EndpointRow>(`select ${COLS} from public.webhook_endpoints where workspace_id = $1 order by created_at`, [ws])).rows;
}

export async function deleteEndpoint(q: Q, ws: string, id: string): Promise<boolean> {
  return (await q.query("delete from public.webhook_endpoints where id = $1 and workspace_id = $2 returning id", [id, ws])).rows.length > 0;
}

export async function setEndpointEnabled(q: Q, ws: string, id: string, enabled: boolean): Promise<boolean> {
  const r = await q.query(
    `update public.webhook_endpoints set disabled_at = case when $3 then null else now() end, disabled_reason = case when $3 then null else 'Turned off' end, failures = case when $3 then 0 else failures end
     where id = $1 and workspace_id = $2 returning id`,
    [id, ws, enabled],
  );
  return r.rows.length > 0;
}

/** Queues an event for every enabled endpoint in the workspace that subscribes to it (or just one endpoint, for a test). */
export async function enqueue(q: Q, ws: string, event: string, key: string, payload: unknown, endpointId?: string): Promise<number> {
  const r = await q.query(
    `insert into public.webhook_deliveries (workspace_id, endpoint_id, event, dedupe_key, payload)
     select $1, e.id, $2, $3, $4::jsonb from public.webhook_endpoints e
     where e.workspace_id = $1 and e.disabled_at is null and (case when $5::uuid is null then $2 = any(e.events) else e.id = $5::uuid end)
     on conflict (endpoint_id, event, dedupe_key) do nothing returning id`,
    [ws, event, key, JSON.stringify(payload), endpointId ?? null],
  );
  return r.rows.length;
}

export type DueDelivery = { id: string; workspace_id: string; endpoint_id: string; event: string; payload: unknown; attempts: number; created_at: string; url: string; secret_enc: Buffer };

/** Claims up to `limit` due deliveries (pushing their next attempt out, so a parallel pass skips them). */
export async function claimDue(q: Q, limit: number, ws: string | null): Promise<DueDelivery[]> {
  return (
    await q.query<DueDelivery>(
      `with due as (
         select d.id from public.webhook_deliveries d join public.webhook_endpoints e on e.id = d.endpoint_id
         where d.status = 'pending' and d.next_attempt_at <= now() and e.disabled_at is null and ($2::uuid is null or d.workspace_id = $2::uuid)
         order by d.next_attempt_at limit $1 for update of d skip locked
       )
       update public.webhook_deliveries d set attempts = d.attempts + 1, next_attempt_at = now() + interval '3 minutes'
       from due, public.webhook_endpoints e
       where d.id = due.id and e.id = d.endpoint_id
       returning d.id, d.workspace_id, d.endpoint_id, d.event, d.payload, d.attempts, d.created_at, e.url, e.secret_enc`,
      [limit, ws],
    )
  ).rows;
}

export async function markDelivered(q: Q, d: Pick<DueDelivery, "id" | "endpoint_id">, status: number) {
  await q.query("update public.webhook_deliveries set status = 'delivered', delivered_at = now(), last_status = $2, last_error = null where id = $1", [d.id, status]);
  await q.query("update public.webhook_endpoints set failures = 0, last_delivery_at = now(), last_status = $2 where id = $1", [d.endpoint_id, `Delivered (HTTP ${status})`]);
}

/** Schedules a retry, or gives up after the last attempt. Endpoints that keep failing are switched off. */
export async function markFailed(q: Q, d: Pick<DueDelivery, "id" | "endpoint_id" | "attempts">, status: number | null, error: string) {
  const final = d.attempts >= MAX_ATTEMPTS;
  const delay = RETRY_DELAYS_S[Math.min(d.attempts - 1, RETRY_DELAYS_S.length - 1)];
  await q.query(
    `update public.webhook_deliveries set status = $2, last_status = $3, last_error = $4, next_attempt_at = now() + make_interval(secs => $5::int) where id = $1`,
    [d.id, final ? "failed" : "pending", status, error.slice(0, 300), delay],
  );
  await q.query(
    `update public.webhook_endpoints set failures = failures + 1, last_delivery_at = now(), last_status = $2,
       disabled_at = case when failures + 1 >= $3 then now() else disabled_at end,
       disabled_reason = case when failures + 1 >= $3 then 'Switched off after repeated failures' else disabled_reason end
     where id = $1`,
    [d.endpoint_id, `Failed: ${error}`.slice(0, 200), DISABLE_AFTER],
  );
}

export type DeliveryRow = { id: string; event: string; status: string; attempts: number; last_status: number | null; last_error: string | null; created_at: string; delivered_at: string | null; url: string };

export async function recentDeliveries(q: Q, ws: string, limit = 20): Promise<DeliveryRow[]> {
  return (
    await q.query<DeliveryRow>(
      `select d.id, d.event, d.status, d.attempts, d.last_status, d.last_error, d.created_at, d.delivered_at, e.url
       from public.webhook_deliveries d join public.webhook_endpoints e on e.id = d.endpoint_id
       where d.workspace_id = $1 order by d.created_at desc limit $2`,
      [ws, limit],
    )
  ).rows;
}

/* ------------------------------------------------------- event payloads */

/** Leads saved in a workspace since a moment, shaped for lead.created. */
export async function leadsSince(q: Q, ws: string, since: Date) {
  return (
    await q.query<{ lead_id: string; name: string; website: string | null; email: string | null; source: string; created_at: string }>(
      `select l.id as lead_id, b.name, b.website, (select c.email_normalized from public.contacts c where c.business_id = b.id order by c.created_at limit 1) as email,
         case when b.provider = 'google_places' then 'google_maps' else b.provider end as source, l.created_at
       from public.leads l join public.businesses b on b.id = l.business_id
       where l.workspace_id = $1 and l.created_at >= $2::timestamptz - interval '30 seconds' order by l.created_at limit 200`,
      [ws, since],
    )
  ).rows;
}

export async function campaignName(q: Q, id: string): Promise<{ workspace_id: string; name: string; status: string } | null> {
  return (await q.query<{ workspace_id: string; name: string; status: string }>("select workspace_id, name, status from public.campaigns where id = $1", [id])).rows[0] ?? null;
}
