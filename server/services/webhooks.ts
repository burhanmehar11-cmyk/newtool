import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { brand } from "@/config/brand";
import { WEBHOOK_EVENTS, signatureHeader, webhookUrlProblem, type WebhookEvent } from "@/lib/webhooks";
import { requireWorkspace } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import { configuredSiteUrl } from "@/server/env";
import { decryptJson, encryptJson, tokenKey } from "@/server/gmail/crypto";
import { safePost } from "@/server/research/fetch";
import * as store from "@/server/webhook-store";

const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));
const origin = () => configuredSiteUrl() ?? brand.siteUrl;
const MAX_ENDPOINTS = 5;

/* ------------------------------------------------------------ emitting */

/**
 * Queues an event for the workspace's endpoints. Never throws: a missing
 * migration or a database hiccup must not break the action that caused it.
 */
export async function emitWebhook(ws: string, event: WebhookEvent, key: string, data: Record<string, unknown>): Promise<number> {
  try {
    return await svc((q) => store.enqueue(q, ws, event, key, data));
  } catch {
    return 0;
  }
}

/** lead.created for every lead saved in the workspace since `since`. */
export async function emitLeadsCreated(ws: string, since: Date): Promise<number> {
  try {
    const leads = await svc((q) => store.leadsSince(q, ws, since));
    let n = 0;
    for (const l of leads) n += await emitWebhook(ws, "lead.created", l.lead_id, { ...l, url: `${origin()}/app/leads/${l.lead_id}` });
    return n;
  } catch {
    return 0;
  }
}

/* ---------------------------------------------------------- delivering */

export type DeliverySummary = { delivered: number; failed: number };

/** Sends due deliveries (oldest first), signing each with its endpoint's secret. Safe to call from any pass. */
export async function deliverDueWebhooks(opts: { workspaceId?: string | null; limit?: number } = {}): Promise<DeliverySummary> {
  const out: DeliverySummary = { delivered: 0, failed: 0 };
  const key = tokenKey();
  if (!key) return out;
  let due: store.DueDelivery[];
  try {
    due = await svc((q) => store.claimDue(q, opts.limit ?? 20, opts.workspaceId ?? null));
  } catch {
    return out; // migration 0012 not run yet
  }
  for (const d of due) {
    const secret = decryptJson<{ secret: string }>(Buffer.from(d.secret_enc), key)?.secret;
    if (!secret) {
      await svc((q) => store.markFailed(q, d, null, "Signing secret unreadable (SESSION_SECRET changed?). Recreate this endpoint."));
      out.failed++;
      continue;
    }
    const body = JSON.stringify({ id: d.id, event: d.event, created_at: d.created_at, workspace_id: d.workspace_id, data: d.payload });
    const r = await safePost(d.url, body, { "locenti-event": d.event, "locenti-delivery": d.id, "locenti-signature": signatureHeader(secret, body) });
    if (r.ok) {
      await svc((q) => store.markDelivered(q, d, r.status));
      out.delivered++;
    } else {
      await svc((q) => store.markFailed(q, d, r.status, r.reason));
      out.failed++;
    }
  }
  return out;
}

/* ---------------------------------------------------------- managing */

async function manager(path = "/app/agent") {
  const { user, workspace } = await requireWorkspace(path);
  return { user, workspace, allowed: ["owner", "admin"].includes(workspace.role) };
}

export async function getWebhooks() {
  const { workspace, allowed } = await manager();
  if (!allowed) return { allowed: false as const };
  try {
    const { endpoints, deliveries } = await svc(async (q) => ({ endpoints: await store.listEndpoints(q, workspace.id), deliveries: await store.recentDeliveries(q, workspace.id) }));
    return { allowed: true as const, ready: true, endpoints, deliveries, keyOk: !!tokenKey() };
  } catch {
    return { allowed: true as const, ready: false, endpoints: [], deliveries: [], keyOk: !!tokenKey() };
  }
}

const createInput = z.object({ url: z.string().trim().max(500), events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Pick at least one event.").max(WEBHOOK_EVENTS.length) });

/** Creates an endpoint and returns its signing secret once. */
export async function createWebhook(input: unknown): Promise<{ ok: true; secret: string } | { ok: false; error: string }> {
  const { user, workspace, allowed } = await manager();
  if (!allowed) return { ok: false, error: "Only workspace owners and admins can manage webhooks." };
  const p = createInput.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const problem = webhookUrlProblem(p.data.url);
  if (problem) return { ok: false, error: problem };
  const key = tokenKey();
  if (!key) return { ok: false, error: "SESSION_SECRET isn't set on this deployment." };
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  try {
    return await svc(async (q) => {
      if ((await store.countEndpoints(q, workspace.id)) >= MAX_ENDPOINTS) return { ok: false as const, error: `Up to ${MAX_ENDPOINTS} endpoints per workspace.` };
      await store.insertEndpoint(q, workspace.id, user.id, new URL(p.data.url).toString(), [...new Set(p.data.events)], encryptJson({ secret }, key), secret.slice(0, 12));
      return { ok: true as const, secret };
    });
  } catch {
    return { ok: false, error: "Couldn't save the endpoint. Has migration 0012_webhooks.sql been run?" };
  }
}

export async function removeWebhook(id: string) {
  const { workspace, allowed } = await manager();
  if (!allowed || !z.string().uuid().safeParse(id).success) return false;
  return svc((q) => store.deleteEndpoint(q, workspace.id, id));
}

export async function toggleWebhook(id: string, enabled: boolean) {
  const { workspace, allowed } = await manager();
  if (!allowed || !z.string().uuid().safeParse(id).success) return false;
  return svc((q) => store.setEndpointEnabled(q, workspace.id, id, enabled));
}

/** Sends a `ping` event to one endpoint right away and reports what happened. */
export async function testWebhook(id: string): Promise<{ ok: boolean; message: string }> {
  const { workspace, allowed } = await manager();
  if (!allowed || !z.string().uuid().safeParse(id).success) return { ok: false, message: "Not allowed." };
  const queued = await svc((q) => store.enqueue(q, workspace.id, "ping", `ping-${Date.now()}`, { message: `Test from ${brand.name}`, workspace: workspace.name }, id));
  if (!queued) return { ok: false, message: "This endpoint is switched off. Turn it on first." };
  const r = await deliverDueWebhooks({ workspaceId: workspace.id, limit: 5 });
  return r.delivered ? { ok: true, message: "Delivered. Your endpoint answered with a 2xx status." } : { ok: false, message: "Not delivered. See the latest attempt below; it will be retried." };
}
