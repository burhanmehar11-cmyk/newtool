import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser } from "./harness";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
let db: PGlite;
let wsA: string;
let wsB: string;

async function seedBusinessAndLead(ws: string, user: string, ref: string) {
  return as(db, user, async () => {
    const b = await db.query<{ id: string }>(
      `insert into businesses (workspace_id, provider, provider_ref, name, domain_normalized, collected_at)
       values ($1, 'test', $2, 'Biz ' || $2, $2 || '.example', now()) returning id`,
      [ws, ref],
    );
    const lead = await db.query<{ id: string }>(
      "insert into leads (workspace_id, business_id, source) values ($1, $2, 'search') returning id",
      [ws, b.rows[0].id],
    );
    const c = await db.query<{ id: string }>(
      "insert into contacts (workspace_id, business_id, email_normalized) values ($1, $2, $3) returning id",
      [ws, b.rows[0].id, `hello@${ref}.example`],
    );
    return { businessId: b.rows[0].id, leadId: lead.rows[0].id, contactId: c.rows[0].id };
  });
}

beforeAll(async () => {
  db = await createTestDb();
  await createUser(db, A, "a@agency-a.example");
  await createUser(db, B, "b@agency-b.example");
  wsA = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency A') as id")).rows[0].id);
  wsB = await as(db, B, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency B') as id")).rows[0].id);
}, 60_000);

describe("tenancy", () => {
  it("creates a profile for each auth user", async () => {
    const r = await db.query("select count(*)::int as n from profiles");
    expect(r.rows[0]).toEqual({ n: 2 });
  });

  it("makes the creator the owner and seeds allowances", async () => {
    const r = await as(db, A, () => db.query<{ role: string }>("select role from memberships where workspace_id = $1", [wsA]));
    expect(r.rows).toEqual([{ role: "owner" }]);
    const al = await as(db, A, () => db.query("select kind from workspace_allowances where workspace_id = $1 order by kind", [wsA]));
    expect(al.rows.length).toBe(3);
  });

  it("isolates workspaces: B cannot see A's workspace, leads or contacts", async () => {
    await seedBusinessAndLead(wsA, A, "alpha");
    const seen = await as(db, B, async () => ({
      ws: (await db.query("select id from workspaces where id = $1", [wsA])).rows.length,
      leads: (await db.query("select id from leads where workspace_id = $1", [wsA])).rows.length,
      contacts: (await db.query("select id from contacts")).rows.length,
      audit: (await db.query("select id from audit_events where workspace_id = $1", [wsA])).rows.length,
    }));
    expect(seen).toEqual({ ws: 0, leads: 0, contacts: 0, audit: 0 });
  });

  it("prevents B from writing into A's workspace", async () => {
    await expect(
      as(db, B, () =>
        db.query("insert into businesses (workspace_id, provider, provider_ref, name, collected_at) values ($1, 'test', 'x', 'X', now())", [wsA]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("prevents B from updating or deleting A's rows (silently zero rows)", async () => {
    const r = await as(db, B, () => db.query("update leads set notes = 'pwned' where workspace_id = $1", [wsA]));
    expect(r.affectedRows ?? 0).toBe(0);
    const d = await as(db, B, () => db.query("delete from leads where workspace_id = $1", [wsA]));
    expect(d.affectedRows ?? 0).toBe(0);
  });

  it("prevents users from adding themselves to another workspace", async () => {
    await expect(as(db, B, () => db.query("insert into memberships (workspace_id, user_id, role) values ($1, $2, 'owner')", [wsA, B]))).rejects.toThrow();
  });

  it("gives anonymous callers nothing", async () => {
    await expect(as(db, null, () => db.query("select * from workspaces"))).rejects.toThrow(/permission denied/);
    await expect(as(db, null, () => db.query("select public.create_workspace('x')"))).rejects.toThrow(/permission denied/);
  });

  it("keeps mailbox secrets away from members", async () => {
    await expect(as(db, A, () => db.query("select * from sending_account_secrets"))).rejects.toThrow(/permission denied/);
  });

  it("does not let members write the usage ledger directly", async () => {
    await expect(
      as(db, A, () =>
        db.query("insert into usage_ledger (workspace_id, kind, entry_type, units, idempotency_key) values ($1, 'ai', 'refund', 999, 'x')", [wsA]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("usage reservations", () => {
  const reserve = (ws: string, user: string, units: number, key: string) =>
    as(db, user, async () => (await db.query<{ r: { reserved: number; idempotent: boolean } }>("select public.reserve_usage($1, 'discovery', $2, $3) as r", [ws, units, key])).rows[0].r);
  const committed = (ws: string) => db.query<{ n: number }>("select app.committed_units($1, 'discovery') as n", [ws]).then((r) => r.rows[0].n);

  it("reserves within the allowance and is idempotent per key", async () => {
    const first = await reserve(wsA, A, 25, "job-1");
    const again = await reserve(wsA, A, 25, "job-1");
    expect(first).toMatchObject({ reserved: 25, idempotent: false });
    expect(again).toMatchObject({ reserved: 25, idempotent: true });
    expect(await committed(wsA)).toBe(25);
  });

  it("settles by charging actual use and releasing the rest, idempotently", async () => {
    await as(db, A, () => db.query("select public.settle_usage($1, 'job-1', 18)", [wsA]));
    await as(db, A, () => db.query("select public.settle_usage($1, 'job-1', 18)", [wsA]));
    expect(await committed(wsA)).toBe(18);
  });

  it("refuses reservations that would exceed the allowance", async () => {
    await expect(reserve(wsA, A, 483, "job-2")).rejects.toThrow(/quota_exceeded/);
    await expect(reserve(wsA, A, 482, "job-3")).resolves.toMatchObject({ reserved: 482 });
    await expect(reserve(wsA, A, 1, "job-4")).rejects.toThrow(/quota_exceeded/);
  });

  it("never overspends across many simultaneous reservations (lock contention itself needs a real-Postgres run)", async () => {
    // Fresh workspace for B; allowance 500. Ten parallel 60-unit reservations: at most 8 fit.
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => reserve(wsB, B, 60, `par-${i}`)));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(8);
    expect(await committed(wsB)).toBe(480);
  });

  it("refuses to reserve against someone else's workspace", async () => {
    await expect(reserve(wsA, B, 1, "steal")).rejects.toThrow(/forbidden/);
  });
});

describe("integrity constraints", () => {
  it("prevents duplicate active outreach to the same contact across campaigns", async () => {
    const { leadId, contactId } = await seedBusinessAndLead(wsA, A, "beta");
    await as(db, A, async () => {
      const mk = async (name: string) =>
        (await db.query<{ id: string }>("insert into campaigns (workspace_id, name, schedule) values ($1, $2, '{}') returning id", [wsA, name])).rows[0].id;
      const c1 = await mk("One");
      const c2 = await mk("Two");
      await db.query("insert into enrollments (workspace_id, campaign_id, lead_id, contact_id) values ($1, $2, $3, $4)", [wsA, c1, leadId, contactId]);
      await expect(
        db.query("insert into enrollments (workspace_id, campaign_id, lead_id, contact_id) values ($1, $2, $3, $4)", [wsA, c2, leadId, contactId]),
      ).rejects.toThrow(/enrollments_one_active_per_contact/);
      // Once the first is stopped, a new campaign may enrol the contact.
      await db.query("update enrollments set state = 'stopped' where campaign_id = $1", [c1]);
      await db.query("insert into enrollments (workspace_id, campaign_id, lead_id, contact_id) values ($1, $2, $3, $4)", [wsA, c2, leadId, contactId]);
    });
  });

  it("keeps suppression entries unique and lower-case per workspace", async () => {
    await as(db, A, async () => {
      await db.query("insert into suppression_entries (workspace_id, value, kind, reason) values ($1, 'stop@x.example', 'email', 'unsubscribe')", [wsA]);
      await expect(db.query("insert into suppression_entries (workspace_id, value, kind, reason) values ($1, 'stop@x.example', 'email', 'manual')", [wsA])).rejects.toThrow();
      await expect(db.query("insert into suppression_entries (workspace_id, value, kind, reason) values ($1, 'UPPER@x.example', 'email', 'manual')", [wsA])).rejects.toThrow();
    });
  });

  it("never records a verified status without a timestamp", async () => {
    await as(db, A, async () => {
      const b = await db.query<{ id: string }>("select id from businesses where workspace_id = $1 limit 1", [wsA]);
      await expect(
        db.query("insert into contacts (workspace_id, business_id, email_normalized, status) values ($1, $2, 'x@y.example', 'valid')", [wsA, b.rows[0].id]),
      ).rejects.toThrow();
    });
  });

  it("allows one dispatch per enrollment step", async () => {
    await as(db, A, async () => {
      const e = await db.query<{ id: string }>("select id from enrollments where workspace_id = $1 limit 1", [wsA]);
      await db.query("insert into dispatches (workspace_id, enrollment_id, step) values ($1, $2, 1)", [wsA, e.rows[0].id]);
      await expect(db.query("insert into dispatches (workspace_id, enrollment_id, step) values ($1, $2, 1)", [wsA, e.rows[0].id])).rejects.toThrow();
    });
  });
});
