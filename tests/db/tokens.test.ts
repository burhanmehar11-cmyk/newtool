import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { insertToken, listTokens, resolveToken, revokeToken } from "@/server/token-store";
import { as, createTestDb, createUser } from "./harness";

const A = "00000000-0000-4000-8000-0000000000a5";
const B = "00000000-0000-4000-8000-0000000000b5";
let db: PGlite;
let q: Q;
let ws: string;
const H1 = "a".repeat(64);
const H2 = "b".repeat(64);

beforeAll(async () => {
  db = await createTestDb();
  q = db as unknown as Q;
  await createUser(db, A, "a@agency.example");
  await createUser(db, B, "b@agency.example");
  ws = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency A') as id")).rows[0].id);
  await as(db, B, () => db.query("select public.create_workspace('Agency B')"));
}, 60_000);

describe("MCP access tokens", () => {
  let id: string;
  it("resolves a token to its user, workspace and role", async () => {
    id = await as(db, A, () => insertToken(q, ws, A, "Claude", H1, "loc_abcdefgh"));
    expect(await resolveToken(q, H1)).toMatchObject({ userId: A, workspaceId: ws, workspaceName: "Agency A", role: "owner" });
    expect(await resolveToken(q, H2)).toBeNull();
  });
  it("is private to its owner", async () => {
    expect(await as(db, B, () => listTokens(q, ws))).toEqual([]);
    expect(await as(db, B, () => revokeToken(q, id))).toBe(false);
    await expect(as(db, B, () => insertToken(q, ws, B, "x", H2, "loc_x"))).rejects.toThrow();
  });
  it("stops working when revoked or when the person leaves the workspace", async () => {
    await as(db, A, () => insertToken(q, ws, A, "Second", H2, "loc_second"));
    expect(await as(db, A, () => revokeToken(q, id))).toBe(true);
    expect(await resolveToken(q, H1)).toBeNull();
    expect(await resolveToken(q, H2)).not.toBeNull();
    await db.query("delete from public.memberships where user_id = $1", [A]);
    expect(await resolveToken(q, H2)).toBeNull();
  });
});
