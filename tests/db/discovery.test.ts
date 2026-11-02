import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { OsmBusiness } from "@/lib/discovery/osm";
import type { Q } from "@/server/auth-store";
import { createJob, finishJob, getJob, jobResults, listLeads, persistResults, recentJobs, reserve, saveLeads, settle } from "@/server/discovery-store";
import { as, createTestDb, createUser } from "./harness";

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b1";
let db: PGlite;
let q: Q;
let wsA: string;
let wsB: string;

const biz = (n: number, extra: Partial<OsmBusiness> = {}): OsmBusiness => ({
  ref: `osm:node/${n}`,
  name: `Clinic ${n}`,
  category: "amenity=dentist",
  address: `${n} Main St, Austin, TX`,
  city: "Austin",
  region: "TX",
  phone: null,
  website: `https://clinic${n}.example/`,
  domain: `clinic${n}.example`,
  email: n % 2 ? `hello@clinic${n}.example` : null,
  lat: 30.27,
  lon: -97.74,
  distanceKm: n / 10,
  sourceUrl: `https://www.openstreetmap.org/node/${n}`,
  excerpt: `name=Clinic ${n}\namenity=dentist`,
  ...extra,
});

const filters = { niche: "dental", place: "Austin, TX", radiusKm: 5, website: "any" as const, maxResults: 25 };

beforeAll(async () => {
  db = await createTestDb();
  q = db as unknown as Q;
  await createUser(db, A, "a@agency.example");
  await createUser(db, B, "b@agency.example");
  wsA = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency A') as id")).rows[0].id);
  wsB = await as(db, B, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency B') as id")).rows[0].id);
}, 60_000);

describe("discovery persistence (as the signed-in user)", () => {
  it("runs a search end to end: reserve, store, settle, finish", async () => {
    const jobId = await as(db, A, async () => {
      const id = await createJob(q, wsA, A, "dentists in Austin", filters);
      await reserve(q, wsA, id, 25);
      await persistResults(q, wsA, id, [biz(1), biz(2), biz(3)]);
      await settle(q, wsA, id, 3);
      await finishJob(q, id, "completed", 3, null);
      return id;
    });
    const job = await as(db, A, () => getJob(q, jobId));
    expect(job).toMatchObject({ status: "completed", charged_units: 3, estimated_units: 25 });
    const rows = await as(db, A, () => jobResults(q, jobId));
    expect(rows.map((r) => r.name)).toEqual(["Clinic 1", "Clinic 2", "Clinic 3"]);
    expect(rows[0]).toMatchObject({ email: "hello@clinic1.example", email_status: "unverified", source_url: "https://www.openstreetmap.org/node/1", saved: false });
    expect(rows[1].email).toBeNull();
    const charged = await as(db, A, () => db.query<{ n: number }>("select coalesce(sum(units),0)::int as n from usage_ledger where entry_type = 'charge'"));
    expect(charged.rows[0].n).toBe(3);
  });

  it("deduplicates businesses and evidence across repeated searches", async () => {
    await as(db, A, async () => {
      const id = await createJob(q, wsA, A, "again", filters);
      await persistResults(q, wsA, id, [biz(1), biz(2, { name: "Clinic 2 (renamed)" })]);
    });
    const counts = await as(db, A, () =>
      db.query<{ b: number; e: number; c: number }>("select (select count(*) from businesses)::int as b, (select count(*) from evidence)::int as e, (select count(*) from contacts)::int as c"),
    );
    expect(counts.rows[0]).toEqual({ b: 3, e: 3, c: 2 });
    const renamed = await as(db, A, () => db.query("select name from businesses where provider_ref = 'osm:node/2'"));
    expect(renamed.rows[0]).toEqual({ name: "Clinic 2 (renamed)" });
  });

  it("saves only chosen leads, once", async () => {
    const ids = await as(db, A, async () => (await db.query<{ id: string }>("select id from businesses order by name")).rows.map((r) => r.id));
    expect(await as(db, A, () => saveLeads(q, wsA, A, ids.slice(0, 2)))).toBe(2);
    expect(await as(db, A, () => saveLeads(q, wsA, A, ids))).toBe(1);
    const leads = await as(db, A, () => listLeads(q, wsA));
    expect(leads).toHaveLength(3);
    expect(leads.every((l) => l.saved)).toBe(true);
  });

  it("keeps workspaces apart: B sees none of A's searches, businesses or leads", async () => {
    const seen = await as(db, B, async () => ({
      jobs: (await recentJobs(q, wsA)).length,
      leads: (await listLeads(q, wsA)).length,
      biz: (await db.query("select id from businesses")).rows.length,
    }));
    expect(seen).toEqual({ jobs: 0, leads: 0, biz: 0 });
    // B can't save A's businesses into B's workspace either.
    const aIds = await as(db, A, async () => (await db.query<{ id: string }>("select id from businesses")).rows.map((r) => r.id));
    expect(await as(db, B, () => saveLeads(q, wsB, B, aIds))).toBe(0);
  });

  it("refuses a search that would exceed the allowance", async () => {
    await expect(
      as(db, B, async () => {
        const id = await createJob(q, wsB, B, "too big", { ...filters, maxResults: 999 });
        await reserve(q, wsB, id, 999);
      }),
    ).rejects.toThrow(/quota_exceeded/);
  });
});
