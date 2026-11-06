import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser } from "./harness";

const h = vi.hoisted(() => ({ db: null as unknown as PGlite, as: null as unknown as typeof import("./harness").as }));
vi.mock("@/server/db", () => ({
  withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db),
  withUser: (userId: string, fn: (q: unknown) => Promise<unknown>) => h.as(h.db, userId, () => fn(h.db)),
}));

const { reserveDiscovery, monthlyDiscovery, monthlyResetDate } = await import("@/server/services/discovery");
const { settle } = await import("@/server/discovery-store");

const U = "00000000-0000-4000-8000-00000000f0f0";
let db: PGlite;
let ws: string;
const allowance = async () => (await db.query<{ units: number }>("select units from public.workspace_allowances where workspace_id = $1 and kind = 'discovery'", [ws])).rows[0].units;
const committed = async () => Number((await db.query<{ n: number }>("select app.committed_units($1, 'discovery') as n", [ws])).rows[0].n);
const job = async () => (await as(db, U, () => db.query<{ id: string }>("insert into public.discovery_jobs (workspace_id, created_by, query, filters, provider, estimated_units) values ($1, $2, 'q', '{}'::jsonb, 'google_places', 60) returning id", [ws, U]))).rows[0].id;

beforeAll(async () => {
  db = await createTestDb();
  h.db = db;
  h.as = as;
  await createUser(db, U, "searcher@agency.example");
  ws = await as(db, U, async () => (await db.query<{ id: string }>("select public.create_workspace('Searchers') as id")).rows[0].id);
}, 60_000);

describe("discovery units while billing isn't enforced", () => {
  beforeAll(() => {
    process.env.DISCOVERY_MONTHLY_LIMIT = "off";
  });
  afterAll(() => {
    delete process.env.DISCOVERY_MONTHLY_LIMIT;
  });

  it("tops a workspace up instead of blocking, and still records the usage", async () => {
    const start = await allowance();
    // Use up the whole allowance in one go.
    await reserveDiscovery(U, ws, await job(), start);
    expect(await committed()).toBe(start);
    // The next search would have been refused: now it goes through.
    await reserveDiscovery(U, ws, await job(), 60);
    expect(await committed()).toBe(start + 60);
    expect(await allowance()).toBe(start + 60);
  });

  it("blocks again once plan limits are enforced", async () => {
    process.env.BILLING_ENFORCE = "true";
    try {
      await expect(reserveDiscovery(U, ws, await job(), 60)).rejects.toThrow(/quota_exceeded/);
    } finally {
      delete process.env.BILLING_ENFORCE;
    }
  });
});

describe("monthly limit per workspace (default 200)", () => {
  const V = "00000000-0000-4000-8000-00000000f0f1";
  let w: string;
  const jobFor = async () => (await as(db, V, () => db.query<{ id: string }>("insert into public.discovery_jobs (workspace_id, created_by, query, filters, provider, estimated_units) values ($1, $2, 'q', '{}'::jsonb, 'google_places', 60) returning id", [w, V]))).rows[0].id;
  beforeAll(async () => {
    await createUser(db, V, "monthly@agency.example");
    w = await as(db, V, async () => (await db.query<{ id: string }>("select public.create_workspace('Monthly') as id")).rows[0].id);
  });

  it("gives fewer units than asked near the limit, then refuses until next month", async () => {
    // Three full searches that each return 60: 180 used.
    for (let i = 0; i < 3; i++) {
      const j = await jobFor();
      expect(await reserveDiscovery(V, w, j, 60)).toBe(60);
      await as(db, V, () => settle(db as never, w, `${j}`, 60));
    }
    expect(await monthlyDiscovery(V, w)).toMatchObject({ limit: 200, used: 180, left: 20 });
    // Only 20 left: the next search may return at most 20.
    const j = await jobFor();
    expect(await reserveDiscovery(V, w, j, 60)).toBe(20);
    // While it runs, its 20 count as used.
    await expect(reserveDiscovery(V, w, await jobFor(), 20)).rejects.toThrow(/monthly_limit/);
    // It returned only 5, so 15 come back.
    await as(db, V, () => settle(db as never, w, j, 5));
    expect((await monthlyDiscovery(V, w)).left).toBe(15);
  });

  it("doesn't count last month's searches", async () => {
    await db.query("update public.usage_ledger set created_at = created_at - interval '40 days' where workspace_id = $1", [w]);
    expect(await monthlyDiscovery(V, w)).toMatchObject({ used: 0, left: 200 });
  });

  it("doesn't apply to paid or complimentary plans, or when switched off", async () => {
    await db.query("update public.workspaces set plan = 'comp' where id = $1", [w]);
    expect((await monthlyDiscovery(V, w)).limit).toBeNull();
    await db.query("update public.workspaces set plan = 'trial' where id = $1", [w]);
    process.env.DISCOVERY_MONTHLY_LIMIT = "off";
    try {
      expect((await monthlyDiscovery(V, w)).limit).toBeNull();
    } finally {
      delete process.env.DISCOVERY_MONTHLY_LIMIT;
    }
    process.env.DISCOVERY_MONTHLY_LIMIT = "50";
    try {
      expect((await monthlyDiscovery(V, w)).limit).toBe(50);
    } finally {
      delete process.env.DISCOVERY_MONTHLY_LIMIT;
    }
  });

  it("resets on the 1st of next month (UTC)", () => {
    expect(monthlyResetDate(new Date("2026-12-31T23:30:00Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
