import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { as, createTestDb, createUser } from "./harness";

const h = vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  return { db: null as unknown as PGlite, post: vi.fn() };
});
vi.mock("@/server/db", () => ({ withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db) }));
vi.mock("@/server/research/fetch", () => ({ safePost: (...a: unknown[]) => h.post(...a) }));

const store = await import("@/server/webhook-store");
const { deliverDueWebhooks, emitWebhook, emitLeadsCreated } = await import("@/server/services/webhooks");
const { encryptJson, tokenKey } = await import("@/server/gmail/crypto");
const { verifySignature, MAX_ATTEMPTS, DISABLE_AFTER } = await import("@/lib/webhooks");

const A = "00000000-0000-4000-8000-0000000000f1";
const B = "00000000-0000-4000-8000-0000000000f2";
let db: PGlite;
let q: Q;
let ws: string;
let wsB: string;
let replies: string;
let leads: string;
const SECRET = "whsec_unit_test";

const deliveries = async () => (await db.query<{ event: string; status: string; attempts: number; endpoint_id: string }>("select event, status, attempts, endpoint_id from public.webhook_deliveries order by created_at")).rows;

beforeAll(async () => {
  db = await createTestDb();
  h.db = db;
  q = db as unknown as Q;
  await createUser(db, A, "a@hooks.example");
  await createUser(db, B, "b@hooks.example");
  ws = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Hooks A') as id")).rows[0].id);
  wsB = await as(db, B, async () => (await db.query<{ id: string }>("select public.create_workspace('Hooks B') as id")).rows[0].id);
  const enc = encryptJson({ secret: SECRET }, tokenKey()!);
  replies = await store.insertEndpoint(q, ws, A, "https://hooks.example.com/replies", ["reply.received"], enc, "whsec_unit_");
  leads = await store.insertEndpoint(q, ws, A, "https://hooks.example.com/leads", ["lead.created", "reply.received"], enc, "whsec_unit_");
  await store.insertEndpoint(q, wsB, B, "https://other.example.com/hook", ["reply.received"], enc, "whsec_unit_");
}, 60_000);

beforeEach(async () => {
  await db.query("delete from public.webhook_deliveries");
  await db.query("update public.webhook_endpoints set failures = 0, disabled_at = null, disabled_reason = null");
  h.post.mockReset();
  h.post.mockResolvedValue({ ok: true, status: 200 });
});

describe("webhook queue", () => {
  it("queues an event once per subscribed endpoint in that workspace only", async () => {
    expect(await emitWebhook(ws, "reply.received", "msg-1", { label: "interested" })).toBe(2);
    expect(await emitWebhook(ws, "reply.received", "msg-1", { label: "interested" })).toBe(0); // same message again
    expect(await emitWebhook(ws, "lead.created", "lead-1", {})).toBe(1);
    expect(await emitWebhook(ws, "email.sent", "d-1", {})).toBe(0); // nobody subscribed
    expect((await deliveries()).length).toBe(3);
  });

  it("delivers signed JSON a receiver can verify", async () => {
    await emitWebhook(ws, "lead.created", "lead-2", { lead_id: "lead-2", name: "Riverbend Dental" });
    expect(await deliverDueWebhooks({ workspaceId: ws })).toEqual({ delivered: 1, failed: 0 });
    const [url, body, headers] = h.post.mock.calls[0] as [string, string, Record<string, string>];
    expect(url).toBe("https://hooks.example.com/leads");
    expect(JSON.parse(body)).toMatchObject({ event: "lead.created", workspace_id: ws, data: { name: "Riverbend Dental" } });
    expect(headers["locenti-event"]).toBe("lead.created");
    expect(verifySignature(SECRET, body, headers["locenti-signature"])).toBe(true);
    expect((await deliveries())[0]).toMatchObject({ status: "delivered", attempts: 1 });
    expect(await deliverDueWebhooks({ workspaceId: ws })).toEqual({ delivered: 0, failed: 0 }); // nothing left
  });

  it("retries with backoff, then gives up", async () => {
    h.post.mockResolvedValue({ ok: false, status: 500, reason: "HTTP 500" });
    await emitWebhook(ws, "lead.created", "lead-3", {});
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      await db.query("update public.webhook_deliveries set next_attempt_at = now() - interval '1 second'");
      expect(await deliverDueWebhooks({ workspaceId: ws })).toEqual({ delivered: 0, failed: 1 });
    }
    expect((await deliveries())[0]).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
    const next = (await db.query<{ wait: number }>("select extract(epoch from next_attempt_at - now())::int as wait from public.webhook_deliveries")).rows[0].wait;
    expect(next).toBeGreaterThan(0);
  });

  it("waits before retrying (not due right after a failure)", async () => {
    h.post.mockResolvedValueOnce({ ok: false, status: null, reason: "timed out" });
    await emitWebhook(ws, "lead.created", "lead-4", {});
    await deliverDueWebhooks({ workspaceId: ws });
    expect(await deliverDueWebhooks({ workspaceId: ws })).toEqual({ delivered: 0, failed: 0 });
    expect(h.post).toHaveBeenCalledTimes(1);
  });

  it("switches off an endpoint that keeps failing, and skips it", async () => {
    await db.query("update public.webhook_endpoints set failures = $2 where id = $1", [leads, DISABLE_AFTER - 1]);
    h.post.mockResolvedValue({ ok: false, status: 410, reason: "HTTP 410" });
    await emitWebhook(ws, "lead.created", "lead-5", {});
    await deliverDueWebhooks({ workspaceId: ws });
    const e = (await db.query<{ disabled_at: string | null; disabled_reason: string | null }>("select disabled_at, disabled_reason from public.webhook_endpoints where id = $1", [leads])).rows[0];
    expect(e.disabled_at).not.toBeNull();
    expect(e.disabled_reason).toMatch(/repeated failures/);
    expect(await emitWebhook(ws, "lead.created", "lead-6", {})).toBe(0); // disabled endpoints get nothing new
  });

  it("emits lead.created for leads saved just now", async () => {
    const since = new Date();
    await as(db, A, async () => {
      const b = (await db.query<{ id: string }>("insert into public.businesses (workspace_id, provider, provider_ref, name, website, collected_at) values ($1, 'google_places', 'gp:1', 'Lakeview Smiles', 'https://lakeview.example', now()) returning id", [ws])).rows[0].id;
      await db.query("insert into public.leads (workspace_id, business_id, source) values ($1, $2, 'search')", [ws, b]);
    });
    expect(await emitLeadsCreated(ws, since)).toBe(1);
    const payload = (await db.query<{ payload: Record<string, unknown> }>("select payload from public.webhook_deliveries")).rows[0].payload;
    expect(payload).toMatchObject({ name: "Lakeview Smiles", website: "https://lakeview.example", source: "google_maps" });
    expect(await emitLeadsCreated(ws, since)).toBe(0); // already queued
  });

  it("keeps endpoints and deliveries away from signed-in users", async () => {
    await expect(as(db, A, () => db.query("select * from public.webhook_endpoints"))).rejects.toThrow(/permission denied/);
    await expect(as(db, A, () => db.query("select * from public.webhook_deliveries"))).rejects.toThrow(/permission denied/);
    expect((await store.listEndpoints(q, wsB)).map((e) => e.url)).toEqual(["https://other.example.com/hook"]);
    expect(await store.deleteEndpoint(q, wsB, replies)).toBe(false); // another workspace's endpoint
  });
});
