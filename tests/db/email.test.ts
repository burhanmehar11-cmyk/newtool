import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { upsertMailbox } from "@/server/mailbox-store";
import { as, createTestDb, createUser } from "./harness";

const h = vi.hoisted(() => ({ db: null as unknown as PGlite, send: vi.fn(), token: vi.fn() }));
vi.mock("@/server/db", () => ({ withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db) }));
vi.mock("@/server/gmail/google", () => ({ sendRaw: (...a: unknown[]) => h.send(...a) }));
vi.mock("@/server/services/mailboxes", () => ({ accessTokenFor: (...a: unknown[]) => h.token(...a) }));

const OWNER = "00000000-0000-4000-8000-00000000e0a1";
const CUSTOMER = "00000000-0000-4000-8000-00000000e0a2";
let db: PGlite;
let q: Q;

// The module caches its mailbox lookup for a minute: load it fresh per test.
const load = async () => {
  vi.resetModules();
  return import("@/server/email");
};

beforeAll(async () => {
  db = await createTestDb();
  h.db = db;
  q = db as unknown as Q;
  await createUser(db, OWNER, "burhan@locenti.example");
  await createUser(db, CUSTOMER, "client@shop.example");
  const wsOwner = await as(db, OWNER, async () => (await db.query<{ id: string }>("select public.create_workspace('Locenti HQ') as id")).rows[0].id);
  const wsCustomer = await as(db, CUSTOMER, async () => (await db.query<{ id: string }>("select public.create_workspace('Client Co') as id")).rows[0].id);
  await as(db, CUSTOMER, () => upsertMailbox(q, wsCustomer, CUSTOMER, "client@shop.example", "Client", "https://www.googleapis.com/auth/gmail.send"));
  await as(db, OWNER, () => upsertMailbox(q, wsOwner, OWNER, "hello@locenti.example", "Burhan", "https://www.googleapis.com/auth/gmail.send"));
}, 60_000);

beforeEach(() => {
  delete process.env.SMTP_URL;
  delete process.env.SYSTEM_EMAIL_FROM;
  delete process.env.ADMIN_EMAILS;
  h.send.mockReset().mockResolvedValue({ ok: true, id: "m1", threadId: "t1" });
  h.token.mockReset().mockResolvedValue({ ok: true, token: "tok" });
});

describe("account emails without SMTP", () => {
  it("are off when there's no SMTP and no admin", async () => {
    const m = await load();
    expect(await m.emailAvailable()).toBe(false);
    await expect(m.sendEmail("a@b.example", "Hi", "Text")).rejects.toThrow(/not configured/);
  });

  it("go out from the admin's connected Gmail, never a customer's", async () => {
    process.env.ADMIN_EMAILS = "burhan@locenti.example";
    const m = await load();
    expect(await m.emailAvailable()).toBe(true);
    expect(await m.emailChannel()).toEqual({ kind: "gmail", email: "hello@locenti.example" });
    await m.sendEmail("new@user.example", "Confirm your email", "Click the link");
    const raw = Buffer.from(h.send.mock.calls[0][1] as string, "base64url").toString("utf8");
    expect(raw).toMatch(/From: "?Locenti"? <hello@locenti\.example>/);
    expect(raw).toMatch(/To: new@user\.example/);
  });

  it("use SYSTEM_EMAIL_FROM when set", async () => {
    process.env.SYSTEM_EMAIL_FROM = "hello@locenti.example";
    const m = await load();
    expect(await m.emailChannel()).toEqual({ kind: "gmail", email: "hello@locenti.example" });
  });

  it("ignore a disconnected mailbox", async () => {
    process.env.ADMIN_EMAILS = "burhan@locenti.example";
    await db.query("update public.sending_accounts set status = 'needs_reconnect' where email = 'hello@locenti.example'");
    const m = await load();
    expect(await m.emailAvailable()).toBe(false);
    await db.query("update public.sending_accounts set status = 'connected' where email = 'hello@locenti.example'");
  });

  it("prefer SMTP when it's set", async () => {
    process.env.SMTP_URL = "smtps://x%40y.example:pw@smtp.example:465";
    const m = await load();
    expect(await m.emailChannel()).toEqual({ kind: "smtp" });
  });
});
