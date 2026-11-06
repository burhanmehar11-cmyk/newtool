import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser } from "./harness";

const h = vi.hoisted(() => ({ db: null as unknown as PGlite, as: null as unknown as typeof import("./harness").as }));
vi.mock("@/server/db", () => ({
  withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db),
  withUser: (userId: string, fn: (q: unknown) => Promise<unknown>) => h.as(h.db, userId, () => fn(h.db)),
}));

const { reserveDiscovery } = await import("@/server/services/discovery");

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
