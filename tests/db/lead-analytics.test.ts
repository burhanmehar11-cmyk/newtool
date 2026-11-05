import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { leadFunnel, leadQuality, leadTotals, opportunities, searchAreas } from "@/server/analytics-store";
import { as, createTestDb, createUser } from "./harness";

const A = "00000000-0000-4000-8000-0000000000a7";
const B = "00000000-0000-4000-8000-0000000000b7";
let db: PGlite;
let q: Q;
let ws: string;

beforeAll(async () => {
  db = await createTestDb();
  q = db as unknown as Q;
  await createUser(db, A, "a@agency.example");
  await createUser(db, B, "b@agency.example");
  ws = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency A') as id")).rows[0].id);
  await as(db, B, () => db.query("select public.create_workspace('Agency B')"));
  const one = async (sql: string, p: unknown[]) => (await db.query<{ id: string }>(sql, p)).rows[0]?.id;
  await db.query(`insert into public.discovery_jobs (workspace_id, query, filters, provider, status, estimated_units, charged_units) values ($1, 'q1', '{"place":"Boise, ID"}', 'google_places', 'completed', 20, 18), ($1, 'q2', '{"place":"boise, ID "}', 'openstreetmap', 'completed', 20, 7), ($1, 'q3', '{"place":"Austin"}', 'google_places', 'failed', 20, 0)`, [ws]);
  const signals = [
    { onlineBooking: false, siteCopyrightYear: 2015, mobileViewport: false, contactForm: false },
    { onlineBooking: null, siteCopyrightYear: new Date().getFullYear(), mobileViewport: true, contactForm: true },
  ];
  for (const [i, s] of signals.entries()) {
    const b = await one("insert into public.businesses (workspace_id, provider, provider_ref, name, niche, website, collected_at, researched_at, signals) values ($1, 'x', $2, 'B', 'dental', 'https://b.example', now(), now(), $3::jsonb) returning id", [ws, `r${i}`, JSON.stringify(s)]);
    await db.query("insert into public.leads (workspace_id, business_id, source) values ($1, $2, 'search')", [ws, b]);
    await db.query("insert into public.briefs (workspace_id, business_id, offer_type, payload, generator) values ($1, $2, 'web_design', $3::jsonb, 'template')", [ws, b, JSON.stringify({ fit: { level: i ? "weak" : "strong" } })]);
    if (!i) await db.query("insert into public.contacts (workspace_id, business_id, email_normalized) values ($1, $2, 'hi@b.example')", [ws, b]);
  }
  const unresearched = await one("insert into public.businesses (workspace_id, provider, provider_ref, name, collected_at) values ($1, 'x', 'r9', 'C', now()) returning id", [ws]);
  await db.query("insert into public.leads (workspace_id, business_id, source) values ($1, $2, 'search')", [ws, unresearched]);
}, 60_000);

describe("lead analytics", () => {
  it("counts searches and businesses found from completed searches only", async () => {
    const t = await as(db, A, () => leadTotals(q, ws, new Date(Date.now() - 86_400_000), new Date(Date.now() + 1000)));
    expect(t).toMatchObject({ searches: 2, found: 25, saved: 3, researched: 2, emails: 1 });
  });
  it("builds the pipeline and lead quality", async () => {
    expect(await as(db, A, () => leadFunnel(q, ws))).toMatchObject({ found: 25, saved: 3, researched: 2, withEmail: 1, strongFit: 1, contacted: 0, replied: 0 });
    expect(await as(db, A, () => leadQuality(q, ws))).toEqual({ strong: 1, moderate: 0, weak: 1, notResearched: 1, withEmail: 1, withWebsite: 2, total: 3 });
  });
  it("counts only what websites showed as opportunities", async () => {
    const o = await as(db, A, () => opportunities(q, ws));
    const by = Object.fromEntries(o.items.map((i) => [i.key, i.count]));
    expect(o.researched).toBe(2);
    expect(by).toMatchObject({ no_booking: 1, old_site: 1, no_mobile: 1, no_form: 1, pdf_forms: 0 });
  });
  it("groups search areas regardless of spelling, and stays inside the workspace", async () => {
    const areas = await as(db, A, () => searchAreas(q, ws));
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ searches: 2, found: 25, google: 1 });
    expect(await as(db, B, () => leadTotals(q, ws, new Date(0), new Date(Date.now() + 1000)))).toMatchObject({ searches: 0, found: 0, saved: 0 });
  });
});
