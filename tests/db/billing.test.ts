import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser } from "./harness";

const h = vi.hoisted(() => {
  process.env.PADDLE_WEBHOOK_SECRET = "pdl_test_secret";
  process.env.PADDLE_PRICE_GROWTH = "pri_growth";
  process.env.PADDLE_PRICE_STARTER = "pri_starter";
  return { db: null as unknown as PGlite };
});
vi.mock("@/server/db", () => ({ withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db) }));

const { handlePaddleWebhook, accessProblem } = await import("@/server/services/billing");
const { revenue } = await import("@/server/billing-store");
const { plans } = await import("@/config/plans");

const U = "00000000-0000-4000-8000-0000000000b9";
let db: PGlite;
let ws: string;
const send = (body: object, secret = "pdl_test_secret") => {
  const raw = JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  return handlePaddleWebhook(raw, `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex")}`);
};
const plan = async () => (await db.query<{ plan: string }>("select plan from public.workspaces where id = $1", [ws])).rows[0].plan;
const units = async () => Object.fromEntries((await db.query<{ kind: string; units: number }>("select kind, units from public.workspace_allowances where workspace_id = $1", [ws])).rows.map((r) => [r.kind, r.units]));
const sub = (event_id: string, status: string, extra: object = {}) => ({
  event_id,
  event_type: `subscription.${status === "canceled" ? "canceled" : "updated"}`,
  occurred_at: new Date().toISOString(),
  data: { id: "sub_9", status, customer_id: "ctm_9", items: [{ price: { id: "pri_growth" } }], current_billing_period: { ends_at: "2026-12-05T00:00:00Z" }, management_urls: { update_payment_method: "https://pay.example/u", cancel: "https://pay.example/c" }, ...extra },
});

beforeAll(async () => {
  db = await createTestDb();
  h.db = db;
  await createUser(db, U, "payer@agency.example");
  ws = await as(db, U, async () => (await db.query<{ id: string }>("select public.create_workspace('Paying Co') as id")).rows[0].id);
}, 60_000);

describe("Paddle webhooks", () => {
  it("refuses unsigned or wrongly signed requests", async () => {
    expect((await send(sub("evt_bad", "active"), "wrong")).status).toBe(401);
    expect((await handlePaddleWebhook("{}", null)).status).toBe(401);
    expect(await plan()).toBe("trial");
  });

  it("activates the plan from a subscription event carrying the workspace id", async () => {
    const r = await send(sub("evt_a1", "active", { custom_data: { workspace_id: ws } }));
    expect(r).toEqual({ status: 200, note: "Applied." });
    expect(await plan()).toBe("paid");
    const acct = (await db.query("select status, plan_id, manage_url from app.billing_accounts where workspace_id = $1", [ws])).rows[0];
    expect(acct).toMatchObject({ status: "active", plan_id: "growth", manage_url: "https://pay.example/u" });
  });

  it("adds a paid month's units once, even if Paddle retries the event", async () => {
    const before = await units();
    const pay = { event_id: "evt_p1", event_type: "transaction.completed", data: { id: "txn_9", subscription_id: "sub_9", currency_code: "USD", details: { totals: { grand_total: "4900" } }, items: [{ price: { id: "pri_growth" } }] } };
    expect((await send(pay)).note).toBe("Applied.");
    expect((await send(pay)).note).toBe("Already processed.");
    const grant = plans.find((p) => p.id === "growth")!.monthlyGrant;
    expect(await units()).toEqual({ discovery: before.discovery + grant.discovery, verification: before.verification + grant.verification, ai: before.ai + grant.ai });
    const rev = await revenue(db as never, 30);
    expect(rev.byCurrency).toEqual([{ currency: "USD", period: 4900, allTime: 4900, payments: 1 }]);
    expect(rev.mrr).toEqual([{ currency: "USD", amount: 4900 }]);
    expect(rev.subs).toMatchObject({ active: 1 });
  });

  it("finds the workspace by subscription when later events carry no custom data, and lapses on cancel", async () => {
    await send(sub("evt_c1", "canceled"));
    expect(await plan()).toBe("lapsed");
    expect((await revenue(db as never, 30)).subs).toMatchObject({ active: 0, canceled_period: 1 });
  });

  it("stores events it can't match for review, without failing", async () => {
    const r = await send({ ...sub("evt_x1", "active"), data: { ...sub("evt_x1", "active").data, id: "sub_unknown" } });
    expect(r).toEqual({ status: 200, note: "No workspace for this event; stored for review." });
  });

  it("keeps a complimentary plan set by an admin", async () => {
    await db.query("update public.workspaces set plan = 'comp' where id = $1", [ws]);
    await send(sub("evt_a2", "active"));
    expect(await plan()).toBe("comp");
  });

  it("keeps billing records away from signed-in users", async () => {
    await expect(as(db, U, () => db.query("select * from app.billing_accounts"))).rejects.toThrow(/permission denied/);
    await expect(as(db, U, () => db.query("select * from app.billing_events"))).rejects.toThrow(/permission denied/);
  });
});

describe("plan limits", () => {
  it("only block when BILLING_ENFORCE is on, and then for ended trials and lapsed plans", async () => {
    await db.query("update public.workspaces set plan = 'lapsed' where id = $1", [ws]);
    expect(await accessProblem(ws)).toBeNull(); // off by default
    process.env.BILLING_ENFORCE = "true";
    try {
      expect(await accessProblem(ws)).toMatch(/subscription has ended/);
      await db.query("update public.workspaces set plan = 'trial', trial_ends_at = now() - interval '1 day' where id = $1", [ws]);
      expect(await accessProblem(ws)).toMatch(/free trial has ended/);
      await db.query("update public.workspaces set trial_ends_at = now() + interval '3 days' where id = $1", [ws]);
      expect(await accessProblem(ws)).toBeNull();
      await db.query("update public.workspaces set plan = 'paid' where id = $1", [ws]);
      expect(await accessProblem(ws)).toBeNull();
    } finally {
      delete process.env.BILLING_ENFORCE;
    }
  });
});
