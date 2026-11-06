import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import * as admin from "@/server/admin-store";
import { bumpVisit, recordAttribution } from "@/server/attribution-store";
import { as, createTestDb, createUser } from "./harness";

const A = "00000000-0000-4000-8000-0000000000e1";
const B = "00000000-0000-4000-8000-0000000000e2";
let db: PGlite;
let q: Q;
let wsA: string;

beforeAll(async () => {
  db = await createTestDb();
  q = db as unknown as Q;
  await createUser(db, A, "ann@agency.example");
  await createUser(db, B, "bob@studio.example");
  wsA = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Ann Agency') as id")).rows[0].id);
  await as(db, B, () => db.query("select public.create_workspace('Bob Studio')"));
  await recordAttribution(q, A, { source: "linkedin", medium: "social", campaign: "launch", referrerHost: "linkedin.com", landingPath: "/" });
  await bumpVisit(q, "linkedin");
  await bumpVisit(q, "linkedin");
  await bumpVisit(q, "google");
  await as(db, A, async () => {
    const b = (await db.query<{ id: string }>("insert into public.businesses (workspace_id, provider, provider_ref, name, collected_at) values ($1, 'openstreetmap', 'osm:a1', 'Shop', now()) returning id", [wsA])).rows[0].id;
    await db.query("insert into public.leads (workspace_id, business_id, source) values ($1, $2, 'search')", [wsA, b]);
  });
}, 60_000);

describe("sign-up sources", () => {
  it("saves a new account's source once, and never for old accounts", async () => {
    expect(await recordAttribution(q, A, { source: "google", medium: null, campaign: null, referrerHost: null, landingPath: null })).toBe(false); // first one stays
    await db.query("update auth.users set created_at = now() - interval '2 days' where id = $1", [B]);
    expect(await recordAttribution(q, B, { source: "google", medium: null, campaign: null, referrerHost: null, landingPath: null })).toBe(false);
    await db.query("update auth.users set created_at = now() where id = $1", [B]);
  });

  it("keeps sources, visits and the audit log away from signed-in users", async () => {
    for (const t of ["app.signup_attribution", "app.site_visits", "app.admin_audit"]) {
      await expect(as(db, A, () => db.query(`select * from ${t}`))).rejects.toThrow(/permission denied/);
    }
  });
});

describe("admin numbers", () => {
  it("runs every query on the real schema", async () => {
    const o = await admin.overview(q, 14);
    expect(o).toMatchObject({ users: 2, users7: 2, workspaces: 2, leads30: 1, visits30: 3, plans: { trial: 2, paid: 0 } });
    expect(o.active7).toBe(1);
    const d = await admin.daily(q, 7);
    expect(d).toHaveLength(7);
    expect(d.at(-1)).toMatchObject({ signups: 2, visits: 3, leads: 1 });
    const f = await admin.signupFunnel(q, 30);
    expect(f.visits).toBe(3);
    expect(f.steps.map((s) => [s.key, s.count]).slice(0, 4)).toEqual([["signed_up", 2], ["verified", 0], ["workspace", 2], ["lead", 1]]);
    const s = await admin.sources(q, 30);
    expect(s.find((r) => r.source === "linkedin")).toMatchObject({ visits: 2, signups: 1 });
    expect(s.find((r) => r.source === "unknown")).toMatchObject({ signups: 1 });
    expect(s.find((r) => r.source === "google")).toMatchObject({ visits: 1, signups: 0 });
    expect(await admin.campaignsBySignups(q, 30)).toEqual([{ campaign: "launch", source: "linkedin", signups: 1 }]);
    const u = await admin.users(q, "ann");
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ email: "ann@agency.example", source: "linkedin", workspace_name: "Ann Agency", role: "owner", plan: "trial", method: "google" });
    const w = await admin.workspaces(q, 14, "");
    expect(w.find((x) => x.name === "Ann Agency")).toMatchObject({ owner_email: "ann@agency.example", members: 1, leads: 1, plan: "trial", trial_days_left: 14 });
    expect(await admin.emailStats(q, 30)).toMatchObject({ sent: 0, replies: 0, mailboxes: 0 });
    expect(await admin.mailboxProblems(q)).toEqual([]);
    const apis = await admin.sharedApis(q, 7);
    expect(apis.places).toHaveLength(7);
    expect(apis.tokens).toEqual({ active: 0, used7: 0, workspaces: 0 });
    expect(await admin.accountsFor(q, ["ann@agency.example", "nobody@x.example"])).toHaveLength(1);
  });

  it("sets plans by hand with an audit entry; workspace owners can't change their own plan", async () => {
    expect(await admin.setPlan(q, "owner@locenti.com", wsA, { plan: "paid", trialEndsAt: null, note: "Invoice 12" })).toBe(true);
    expect((await admin.overview(q, 14)).plans).toMatchObject({ paid: 1, trial: 1 });
    expect(await admin.auditLog(q)).toMatchObject([{ admin_email: "owner@locenti.com", action: "set_plan", target: "Ann Agency", details: { from: "trial", to: "paid", note: "Invoice 12" } }]);
    expect((await admin.signupFunnel(q, 30)).steps.find((s) => s.key === "paid")?.count).toBe(1);
    await expect(as(db, A, () => db.query("update public.workspaces set plan = 'comp' where id = $1", [wsA]))).rejects.toThrow(/permission denied/);
    await as(db, A, () => db.query("update public.workspaces set name = 'Ann Agency Ltd' where id = $1", [wsA])); // renaming still works
    expect(await admin.setPlan(q, "owner@locenti.com", "00000000-0000-4000-8000-000000000000", { plan: "free", trialEndsAt: null, note: null })).toBe(false);
  });
});

describe("activity feed", () => {
  it("lists sign-ups, workspaces, leads and plan changes, newest first, and every filter runs", async () => {
    const all = await admin.activity(q, "all", "");
    const kinds = all.map((r) => r.kind);
    expect(kinds).toEqual(expect.arrayContaining(["signup", "workspace", "leads", "admin"]));
    const ann = all.find((r) => r.kind === "signup" && r.email === "ann@agency.example");
    expect(ann?.summary).toMatch(/^Signed up with Google · from linkedin \(launch\)$/);
    expect(all.map((r) => new Date(r.at).getTime())).toEqual([...all.map((r) => new Date(r.at).getTime())].sort((a, b) => b - a));
    for (const f of admin.ACTIVITY_FILTERS) await expect(admin.activity(q, f, "")).resolves.toBeInstanceOf(Array);
    expect((await admin.activity(q, "signups", "")).every((r) => r.kind === "signup" || r.kind === "confirm")).toBe(true);
    expect((await admin.activity(q, "all", "bob@studio")).every((r) => r.email === "bob@studio.example")).toBe(true);
    expect(await admin.signupCounts(q)).toMatchObject({ today: 2, byGoogle: 2, byEmail: 0, unconfirmed: 0 });
  });
});
