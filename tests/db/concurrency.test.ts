import { describe, expect, it } from "vitest";
import pg from "pg";
import { DEFAULT_SCHEDULE } from "@/lib/campaigns/schedule";
import { USER_SCOPE_SQL } from "@/server/db-sql";
import { as, createTestDb, createUser, realUrlOf } from "./harness";

/**
 * Real lock contention, which PGlite (one connection, one query at a time)
 * can't produce. Runs only against a real server: TEST_DATABASE_URL, as in CI.
 */
describe.skipIf(!process.env.TEST_DATABASE_URL)("on real Postgres, under contention", () => {
  it("never overspends the allowance when many connections reserve at once", async () => {
    const db = await createTestDb();
    const url = realUrlOf(db)!;
    const U = "00000000-0000-4000-8000-00000000c0c0";
    await createUser(db, U, "race@agency.example");
    const ws = await as(db, U, async () => (await db.query<{ id: string }>("select public.create_workspace('Race') as id")).rows[0].id);
    const allowance = (await db.query<{ units: number }>("select units from public.workspace_allowances where workspace_id = $1 and kind = 'discovery'", [ws])).rows[0].units;

    const attempt = async (i: number) => {
      const c = new pg.Client({ connectionString: url });
      await c.connect();
      try {
        await c.query("begin");
        await c.query(USER_SCOPE_SQL.role);
        await c.query(USER_SCOPE_SQL.setUser, [U]);
        await c.query("select public.reserve_usage($1, 'discovery', 60, $2)", [ws, `race-${i}`]);
        await c.query("commit");
        return true;
      } catch {
        await c.query("rollback").catch(() => undefined);
        return false;
      } finally {
        await c.end();
      }
    };
    const results = await Promise.all(Array.from({ length: 16 }, (_, i) => attempt(i)));
    const committed = Number((await db.query<{ n: number }>("select app.committed_units($1, 'discovery') as n", [ws])).rows[0].n);
    expect(results.filter(Boolean).length).toBe(Math.floor(allowance / 60));
    expect(committed).toBeLessThanOrEqual(allowance);
    expect(committed).toBe(Math.floor(allowance / 60) * 60);
  });

  it("claims each email for sending exactly once across parallel passes", async () => {
    const db = await createTestDb();
    const url = realUrlOf(db)!;
    const U = "00000000-0000-4000-8000-00000000c0c1";
    await createUser(db, U, "race2@agency.example");
    const ws = await as(db, U, async () => (await db.query<{ id: string }>("select public.create_workspace('Race 2') as id")).rows[0].id);
    const e = await as(db, U, async () => {
      const b = (await db.query<{ id: string }>("insert into public.businesses (workspace_id, provider, provider_ref, name, collected_at) values ($1, 'openstreetmap', 'osm:r', 'R', now()) returning id", [ws])).rows[0].id;
      const ct = (await db.query<{ id: string }>("insert into public.contacts (workspace_id, business_id, email_normalized) values ($1, $2, 'r@r.example') returning id", [ws, b])).rows[0].id;
      const l = (await db.query<{ id: string }>("insert into public.leads (workspace_id, business_id, source) values ($1, $2, 'search') returning id", [ws, b])).rows[0].id;
      const c = (await db.query<{ id: string }>("insert into public.campaigns (workspace_id, name, status, schedule) values ($1, 'Race campaign', 'running', $2::jsonb) returning id", [ws, JSON.stringify(DEFAULT_SCHEDULE)])).rows[0].id;
      return (await db.query<{ id: string }>("insert into public.enrollments (workspace_id, campaign_id, lead_id, contact_id, email) values ($1, $2, $3, $4, 'r@r.example') returning id", [ws, c, l, ct])).rows[0].id;
    });
    const claim = async () => {
      const c = new pg.Client({ connectionString: url });
      await c.connect();
      try {
        const r = await c.query("insert into public.dispatches (workspace_id, enrollment_id, step, status, attempted_at) values ($1, $2, 0, 'sending', now()) on conflict (enrollment_id, step) do nothing returning id", [ws, e]);
        return r.rows.length;
      } finally {
        await c.end();
      }
    };
    const won = (await Promise.all(Array.from({ length: 12 }, claim))).reduce((a, b) => a + b, 0);
    expect(won).toBe(1);
  });
});
