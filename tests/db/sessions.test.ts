import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { AUTH_SQL } from "@/server/db-sql";
import { as, createTestDb } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

const one = async <T>(sql: string, params: unknown[]) => (await db.query<T>(sql, params)).rows[0];

describe("Google sign-in bookkeeping (exact production SQL)", () => {
  it("creates a user once per Google subject and refreshes the email on later sign-ins", async () => {
    const a = await one<{ id: string }>(AUTH_SQL.upsertUser, ["google:111", "a@agency.example", "A"]);
    const again = await one<{ id: string }>(AUTH_SQL.upsertUser, ["google:111", "a.new@agency.example", "A"]);
    expect(again.id).toBe(a.id);
    expect((await one<{ email: string }>("select email from auth.users where id = $1", [a.id])).email).toBe("a.new@agency.example");
    // The profile row is created by trigger.
    expect((await one<{ n: number }>("select count(*)::int as n from profiles where id = $1", [a.id])).n).toBe(1);
  });

  it("finds a live session, and not after it is revoked or expired", async () => {
    const u = await one<{ id: string }>(AUTH_SQL.upsertUser, ["google:222", "b@agency.example", "B"]);
    const s = await one<{ id: string }>(AUTH_SQL.createSession, [u.id, 3600, "test"]);
    expect(await one(AUTH_SQL.findSession, [s.id, u.id])).toMatchObject({ id: u.id, email: "b@agency.example" });

    // A session id paired with another user id is rejected.
    const other = await one<{ id: string }>(AUTH_SQL.upsertUser, ["google:333", "c@agency.example", "C"]);
    expect(await one(AUTH_SQL.findSession, [s.id, other.id])).toBeUndefined();

    await db.query(AUTH_SQL.revokeSession, [s.id]);
    expect(await one(AUTH_SQL.findSession, [s.id, u.id])).toBeUndefined();

    const expired = await one<{ id: string }>(AUTH_SQL.createSession, [u.id, -1, "test"]);
    expect(await one(AUTH_SQL.findSession, [expired.id, u.id])).toBeUndefined();
  });

  it("keeps users and sessions away from signed-in clients", async () => {
    const u = await one<{ id: string }>(AUTH_SQL.upsertUser, ["google:444", "d@agency.example", "D"]);
    await expect(as(db, u.id, () => db.query("select * from auth.sessions"))).rejects.toThrow(/permission denied/);
    await expect(as(db, u.id, () => db.query("select * from auth.users"))).rejects.toThrow(/permission denied/);
  });

  it("lets a signed-in user create their first workspace", async () => {
    const u = await one<{ id: string }>(AUTH_SQL.upsertUser, ["google:555", "e@agency.example", "E"]);
    const ws = await as(db, u.id, async () => (await db.query<{ id: string }>("select public.create_workspace('E Agency') as id")).rows[0].id);
    const mine = await as(db, u.id, () =>
      db.query("select w.name, m.role from public.memberships m join public.workspaces w on w.id = m.workspace_id where m.user_id = auth.uid()"),
    );
    expect(ws).toBeTruthy();
    expect(mine.rows).toEqual([{ name: "E Agency", role: "owner" }]);
  });
});
