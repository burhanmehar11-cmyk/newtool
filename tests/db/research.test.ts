import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { createJob, persistResults, saveLeads } from "@/server/discovery-store";
import { contactById, leadDetail, recordDnsCheck, saveNotes, saveResearch, toBusiness } from "@/server/research-store";
import { extractPage } from "@/lib/research/extract";
import { aggregatePages } from "@/lib/research/aggregate";
import { researchBusiness } from "@/lib/research/brief";
import { as, createTestDb, createUser } from "./harness";

const A = "00000000-0000-4000-8000-0000000000a2";
const B = "00000000-0000-4000-8000-0000000000b2";
let db: PGlite;
let q: Q;
let wsA: string;
let leadId: string;

beforeAll(async () => {
  db = await createTestDb();
  q = db as unknown as Q;
  await createUser(db, A, "a@agency.example");
  await createUser(db, B, "b@agency.example");
  wsA = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency A') as id")).rows[0].id);
  await as(db, B, async () => db.query("select public.create_workspace('Agency B')"));
  leadId = await as(db, A, async () => {
    const job = await createJob(q, wsA, A, "dentists", { niche: "dental", place: "Austin", radiusKm: 5, website: "any", maxResults: 10 });
    const [bizId] = await persistResults(q, wsA, job, [
      { ref: "osm:node/5", name: "Riverside Dental", category: "amenity=dentist", address: "1 Main St", city: "Austin", region: "TX", phone: null, website: "https://riverside.example/", domain: "riverside.example", email: null, lat: 0, lon: 0, distanceKm: 0, sourceUrl: "https://www.openstreetmap.org/node/5", excerpt: "name=Riverside Dental" },
    ], "dental");
    await saveLeads(q, wsA, A, [bizId]);
    return (await db.query<{ id: string }>("select id from leads limit 1")).rows[0].id;
  });
}, 60_000);

describe("research persistence", () => {
  it("stores website evidence, signals, found emails and a brief that cites them", async () => {
    const NOW = new Date("2026-11-02T00:00:00Z");
    const home = extractPage(`<p>Please call our office to schedule.</p><footer>© 2018 Riverside</footer><a href="mailto:office@riverside.example">Email</a>`, "https://riverside.example/", NOW);
    const detail = (await as(db, A, () => leadDetail(q, leadId)))!;
    expect(detail.business.niche).toBe("dental");
    const { signals, evidence } = aggregatePages(detail.business.id, [{ role: "home", page: home }], NOW.toISOString(), () => crypto.randomUUID());
    const brief = researchBusiness(toBusiness(detail, evidence, signals), "web_design", NOW.toISOString());
    await as(db, A, () => saveResearch(q, wsA, detail.business.id, { status: "ok", note: "1 page checked", signals, evidence, emails: [{ email: "office@riverside.example", kind: "role" }] }, brief, "web_design"));

    const after = (await as(db, A, () => leadDetail(q, leadId)))!;
    expect(after.business.research_status).toBe("ok");
    expect(after.business.signals?.siteCopyrightYear).toBe(2018);
    expect(after.contacts.map((c) => [c.email_normalized, c.status])).toEqual([["office@riverside.example", "unverified"]]);
    expect(after.brief?.facts.map((f) => f.text)).toContain("Website footer shows © 2018.");
    const evidenceIds = new Set(after.evidence.map((e) => e.id));
    for (const f of after.brief!.facts) for (const id of f.evidenceIds) expect(evidenceIds.has(id)).toBe(true);
  });

  it("records a DNS check but never overwrites a real provider's verdict", async () => {
    const c = (await as(db, A, () => leadDetail(q, leadId)))!.contacts[0];
    expect(await as(db, A, () => recordDnsCheck(q, c.id, "unknown", "Mail servers found."))).toBe(true);
    let row = (await as(db, A, () => leadDetail(q, leadId)))!.contacts[0];
    expect(row).toMatchObject({ status: "unknown", verification_provider: "dns-check", verification_detail: "Mail servers found." });
    await db.query("update contacts set status = 'valid', verification_provider = 'real-verifier' where id = $1", [c.id]);
    expect(await as(db, A, () => recordDnsCheck(q, c.id, "invalid", "No MX."))).toBe(false);
    row = (await as(db, A, () => leadDetail(q, leadId)))!.contacts[0];
    expect(row.status).toBe("valid");
  });

  it("keeps research private to the workspace", async () => {
    expect(await as(db, B, () => leadDetail(q, leadId))).toBeNull();
    const c = (await as(db, A, () => leadDetail(q, leadId)))!.contacts[0];
    expect(await as(db, B, () => contactById(q, c.id))).toBeNull();
    expect(await as(db, B, () => recordDnsCheck(q, c.id, "invalid", "x"))).toBe(false);
    expect(await as(db, B, () => saveNotes(q, leadId, "pwned"))).toBe(false);
    expect(await as(db, A, () => saveNotes(q, leadId, "Call after 3pm"))).toBe(true);
  });
});
