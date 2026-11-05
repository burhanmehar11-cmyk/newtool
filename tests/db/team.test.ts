import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { acceptInvite, acceptInviteById, createInvite, hasTeamAccess, listInvites, listMembers, myInvites, previewInvite, removeMember, revokeInvite, setMemberRole } from "@/server/team-store";
import { as, createTestDb, createUser } from "./harness";

const OWNER = "00000000-0000-4000-8000-0000000000c1";
const MIA = "00000000-0000-4000-8000-0000000000c2"; // invited as member
const ADA = "00000000-0000-4000-8000-0000000000c3"; // invited as admin
const EVE = "00000000-0000-4000-8000-0000000000c4"; // never invited
const h = (n: number) => n.toString(16).padStart(64, "0");

let db: PGlite;
let q: Q;
let ws: string;

beforeAll(async () => {
  db = await createTestDb();
  q = db as unknown as Q;
  await createUser(db, OWNER, "owner@agency.example");
  await createUser(db, MIA, "Mia@Agency.example");
  await createUser(db, ADA, "ada@agency.example");
  await createUser(db, EVE, "eve@elsewhere.example");
  ws = await as(db, OWNER, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency T') as id")).rows[0].id);
}, 60_000);

describe("team invitations", () => {
  it("lets the owner invite, and checks role and email", async () => {
    await as(db, OWNER, () => createInvite(q, ws, "mia@agency.example", "member", h(1)));
    await expect(as(db, OWNER, () => createInvite(q, ws, "x@agency.example", "owner", h(2)))).rejects.toThrow("bad_role");
    await expect(as(db, OWNER, () => createInvite(q, ws, "not-an-email", "member", h(3)))).rejects.toThrow("bad_email");
    await expect(as(db, OWNER, () => createInvite(q, ws, "owner@agency.example", "member", h(4)))).rejects.toThrow("already_member");
    await expect(as(db, EVE, () => createInvite(q, ws, "eve2@x.example", "member", h(5)))).rejects.toThrow("forbidden");
    expect((await as(db, OWNER, () => listInvites(q, ws))).map((i) => i.email)).toEqual(["mia@agency.example"]);
  });

  it("shows invite links' details before sign-in, and lets pending invitees through the allowlist", async () => {
    expect(await previewInvite(q, h(1))).toMatchObject({ workspaceName: "Agency T", email: "mia@agency.example", role: "member", status: "pending" });
    expect(await previewInvite(q, h(99))).toBeNull();
    expect(await hasTeamAccess(q, "MIA@agency.example")).toBe(true);
    expect(await hasTeamAccess(q, "eve@elsewhere.example")).toBe(false);
    expect(await hasTeamAccess(q, "owner@agency.example")).toBe(false); // owners need the allowlist
  });

  it("joins only with the invited email, once", async () => {
    await expect(as(db, EVE, () => acceptInvite(q, h(1)))).rejects.toThrow("wrong_email");
    expect(await as(db, MIA, () => acceptInvite(q, h(1)))).toBe(ws);
    expect(await as(db, MIA, () => acceptInvite(q, h(1)))).toBe(ws); // repeat click is harmless
    await expect(as(db, EVE, () => acceptInvite(q, h(1)))).rejects.toThrow("invalid");
    expect(await previewInvite(q, h(1))).toMatchObject({ status: "used" });
    const members = await as(db, MIA, () => listMembers(q, ws));
    expect(members.map((m) => [m.email, m.role])).toEqual([
      ["owner@agency.example", "owner"],
      ["Mia@Agency.example", "member"],
    ]);
    expect(await hasTeamAccess(q, "mia@agency.example")).toBe(true); // invited member keeps access
  });

  it("refuses expired and revoked invites; a new invite replaces the old one", async () => {
    await as(db, OWNER, () => createInvite(q, ws, "ada@agency.example", "admin", h(10)));
    await as(db, OWNER, () => createInvite(q, ws, "ada@agency.example", "admin", h(11)));
    await expect(as(db, ADA, () => acceptInvite(q, h(10)))).rejects.toThrow("invalid");
    await db.query("update public.workspace_invites set expires_at = now() - interval '1 minute' where token_hash = $1", [h(11)]);
    await expect(as(db, ADA, () => acceptInvite(q, h(11)))).rejects.toThrow("expired");
    const id = await as(db, OWNER, () => createInvite(q, ws, "ada@agency.example", "admin", h(12)));
    expect(await as(db, MIA, () => revokeInvite(q, id))).toBe(false); // members can't revoke
    expect(await as(db, OWNER, () => revokeInvite(q, id))).toBe(true);
    await expect(as(db, ADA, () => acceptInvite(q, h(12)))).rejects.toThrow("invalid");
  });

  it("offers open invites in the app, accepted by id with the same email check", async () => {
    const id = await as(db, OWNER, () => createInvite(q, ws, "ada@agency.example", "admin", h(13)));
    expect(await as(db, EVE, () => myInvites(q))).toEqual([]);
    const mine = await as(db, ADA, () => myInvites(q));
    expect(mine).toMatchObject([{ id, workspace_name: "Agency T", role: "admin" }]);
    await expect(as(db, EVE, () => acceptInviteById(q, id))).rejects.toThrow("wrong_email");
    expect(await as(db, ADA, () => acceptInviteById(q, id))).toBe(ws);
    expect(await as(db, ADA, () => myInvites(q))).toEqual([]);
  });

  it("hides invites and their token hashes from members and outsiders", async () => {
    await as(db, OWNER, () => createInvite(q, ws, "later@agency.example", "member", h(20)));
    expect(await as(db, MIA, () => listInvites(q, ws))).toEqual([]);
    expect(await as(db, EVE, () => listInvites(q, ws))).toEqual([]);
    expect((await as(db, ADA, () => listInvites(q, ws))).length).toBe(1); // admins see them
    await expect(as(db, OWNER, () => db.query("select token_hash from public.workspace_invites"))).rejects.toThrow(/permission denied/);
    await expect(as(db, OWNER, () => db.query("insert into public.workspace_invites (workspace_id, email, role, token_hash) values ($1, 'x@y.example', 'member', $2)", [ws, h(21)]))).rejects.toThrow(/permission denied/);
    expect(await as(db, EVE, () => listMembers(q, ws))).toEqual([]);
  });
});

describe("roles and removal", () => {
  it("lets admins change roles, never the owner's; members can't", async () => {
    await expect(as(db, MIA, () => setMemberRole(q, ws, ADA, "member"))).rejects.toThrow("forbidden");
    expect(await as(db, ADA, () => setMemberRole(q, ws, MIA, "admin"))).toBe(true);
    expect(await as(db, ADA, () => setMemberRole(q, ws, OWNER, "member"))).toBe(false);
    await expect(as(db, ADA, () => setMemberRole(q, ws, MIA, "owner"))).rejects.toThrow("bad_role");
    expect(await as(db, OWNER, () => setMemberRole(q, ws, MIA, "member"))).toBe(true);
  });

  it("lets people leave and admins remove them, but never removes the owner", async () => {
    await expect(as(db, MIA, () => removeMember(q, ws, ADA))).rejects.toThrow("forbidden");
    expect(await as(db, ADA, () => removeMember(q, ws, OWNER))).toBe(false);
    expect(await as(db, OWNER, () => removeMember(q, ws, OWNER))).toBe(false);
    expect(await as(db, MIA, () => removeMember(q, ws, MIA))).toBe(true); // leaving
    expect(await as(db, MIA, () => listMembers(q, ws))).toEqual([]); // and losing access
    expect(await hasTeamAccess(q, "mia@agency.example")).toBe(false);
    expect(await as(db, OWNER, () => removeMember(q, ws, ADA))).toBe(true);
    expect((await as(db, OWNER, () => listMembers(q, ws))).map((m) => m.role)).toEqual(["owner"]);
  });
});
