import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { getMailbox, listMailboxes, loadSecret, markMailbox, saveSecret, updateMailboxSettings, upsertMailbox } from "@/server/mailbox-store";
import { as, createTestDb, createUser } from "./harness";

const A = "00000000-0000-4000-8000-0000000000a3";
const B = "00000000-0000-4000-8000-0000000000b3";
let db: PGlite;
let q: Q;
let wsA: string;
let wsB: string;

beforeAll(async () => {
  db = await createTestDb();
  q = db as unknown as Q;
  await createUser(db, A, "a@agency.example");
  await createUser(db, B, "b@agency.example");
  wsA = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency A') as id")).rows[0].id);
  wsB = await as(db, B, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency B') as id")).rows[0].id);
}, 60_000);

describe("mailboxes", () => {
  let id: string;

  it("connects, reconnects without duplicating, and keeps a chosen sender name", async () => {
    id = await as(db, A, () => upsertMailbox(q, wsA, A, "Sam@Agency.example", "Sam Lee", "openid gmail.send"));
    await as(db, A, () => updateMailboxSettings(q, id, { dailyCap: 15, senderName: "Sam from Northline" }));
    await as(db, A, () => markMailbox(q, id, { status: "needs_reconnect", lastError: "revoked" }));
    const again = await as(db, A, () => upsertMailbox(q, wsA, A, "sam@agency.example", "Sam Lee", "openid gmail.send"));
    expect(again).toBe(id);
    const box = await as(db, A, () => getMailbox(q, id));
    expect(box).toMatchObject({ email: "sam@agency.example", sender_name: "Sam from Northline", status: "connected", daily_cap: 15, last_error: null });
  });

  it("enforces the daily cap range", async () => {
    await expect(as(db, A, () => updateMailboxSettings(q, id, { dailyCap: 500, senderName: null }))).rejects.toThrow();
  });

  it("is invisible to other workspaces", async () => {
    expect(await as(db, B, () => listMailboxes(q, wsA))).toEqual([]);
    expect(await as(db, B, () => getMailbox(q, id))).toBeNull();
    expect(await as(db, B, () => updateMailboxSettings(q, id, { dailyCap: 10, senderName: null }))).toBe(false);
    expect(wsB).toBeTruthy();
  });

  it("stores tokens only through the service connection", async () => {
    await saveSecret(q, id, Buffer.from([1, 2, 3]));
    expect(await loadSecret(q, id)).toEqual(Buffer.from([1, 2, 3]));
    await expect(as(db, A, () => db.query("select * from public.sending_account_secrets"))).rejects.toThrow(/permission denied/);
    await expect(as(db, A, () => saveSecret(q, id, Buffer.from([9])))).rejects.toThrow(/permission denied/);
  });
});
