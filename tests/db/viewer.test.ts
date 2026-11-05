import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { acceptInvite, createInvite, listMembers, setMemberRole } from "@/server/team-store";
import { as, createTestDb, createUser } from "./harness";

const OWNER = "00000000-0000-4000-8000-0000000000d1";
const VIEW = "00000000-0000-4000-8000-0000000000d2";
const MEM = "00000000-0000-4000-8000-0000000000d3";
const h = (n: number) => n.toString(16).padStart(64, "0");
let db: PGlite;
let q: Q;
let ws: string;
let lead: string;

beforeAll(async () => {
  db = await createTestDb();
  q = db as unknown as Q;
  await createUser(db, OWNER, "owner@view.example");
  await createUser(db, VIEW, "client@view.example");
  await createUser(db, MEM, "member@view.example");
  ws = await as(db, OWNER, async () => (await db.query<{ id: string }>("select public.create_workspace('View Co') as id")).rows[0].id);
  lead = await as(db, OWNER, async () => {
    const b = (await db.query<{ id: string }>("insert into public.businesses (workspace_id, provider, provider_ref, name, collected_at) values ($1, 'openstreetmap', 'osm:v1', 'Shop', now()) returning id", [ws])).rows[0].id;
    return (await db.query<{ id: string }>("insert into public.leads (workspace_id, business_id, source) values ($1, $2, 'search') returning id", [ws, b])).rows[0].id;
  });
  await as(db, OWNER, () => createInvite(q, ws, "client@view.example", "viewer", h(1)));
  await as(db, VIEW, () => acceptInvite(q, h(1)));
  await as(db, OWNER, () => createInvite(q, ws, "member@view.example", "member", h(2)));
  await as(db, MEM, () => acceptInvite(q, h(2)));
}, 60_000);

describe("viewer role", () => {
  it("joins as a viewer and sees the workspace's data", async () => {
    expect((await as(db, OWNER, () => listMembers(q, ws))).find((m) => m.user_id === VIEW)?.role).toBe("viewer");
    expect((await as(db, VIEW, () => db.query("select id from public.leads"))).rows).toHaveLength(1);
    expect((await as(db, VIEW, () => db.query("select id from public.businesses"))).rows).toHaveLength(1);
  });

  it("can't insert, update or delete anything", async () => {
    await expect(as(db, VIEW, () => db.query("insert into public.businesses (workspace_id, provider, provider_ref, name, collected_at) values ($1, 'openstreetmap', 'osm:v2', 'X', now())", [ws]))).rejects.toThrow(/row-level security/);
    const upd = await as(db, VIEW, () => db.query("update public.leads set notes = 'hi' where id = $1 returning id", [lead]));
    expect(upd.rows).toHaveLength(0);
    const del = await as(db, VIEW, () => db.query("delete from public.leads where id = $1 returning id", [lead]));
    expect(del.rows).toHaveLength(0);
    await expect(as(db, VIEW, () => db.query("insert into public.suppression_entries (workspace_id, value, kind, reason) values ($1, 'x@y.example', 'email', 'manual')", [ws]))).rejects.toThrow(/row-level security/);
  });

  it("members still write, and roles can move between member and viewer", async () => {
    expect((await as(db, MEM, () => db.query("update public.leads set notes = 'ok' where id = $1 returning id", [lead]))).rows).toHaveLength(1);
    expect(await as(db, OWNER, () => setMemberRole(q, ws, MEM, "viewer"))).toBe(true);
    expect((await as(db, MEM, () => db.query("update public.leads set notes = 'no' where id = $1 returning id", [lead]))).rows).toHaveLength(0);
    expect(await as(db, OWNER, () => setMemberRole(q, ws, MEM, "member"))).toBe(true);
    await expect(as(db, VIEW, () => createInvite(q, ws, "x@view.example", "member", h(3)))).rejects.toThrow("forbidden");
  });
});
