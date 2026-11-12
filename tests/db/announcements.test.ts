import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, createUser } from "./harness";

/** Admin announcements: who gets them, nobody twice, unsubscribes respected, pauses at the mailbox's limit. */

const h = vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  process.env.NEXT_PUBLIC_SITE_URL = "https://locenti.com";
  return { db: null as unknown as PGlite, send: vi.fn() };
});
vi.mock("@/server/db", () => ({ withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db) }));
vi.mock("@/server/services/admin", () => ({ requireAdmin: async () => ({ id: "x", email: "owner@locenti.com", sessionId: "s" }) }));
vi.mock("@/server/email", () => ({ emailChannel: async () => ({ kind: "gmail", email: "owner@gmail.com" }), sendEmail: (...a: unknown[]) => h.send(...a) }));

const svc = await import("@/server/services/announcements");

const ids = ["a1", "a2", "a3", "a4", "a5"].map((x, i) => `00000000-0000-4000-8000-0000000c00${i}${x.slice(1)}`);

beforeAll(async () => {
  h.db = await createTestDb();
  await createUser(h.db, ids[0], "ann.lee@agency.example"); // Google sign-in: confirmed
  await createUser(h.db, ids[1], "bob@studio.example");
  await createUser(h.db, ids[2], "unconfirmed@shop.example");
  await createUser(h.db, ids[3], "optedout@shop.example");
  await createUser(h.db, ids[4], "carla@bakery.example");
  await h.db.query("update auth.users set auth_subject = 'email:' || email, email_verified_at = null where id = $1", [ids[2]]);
  await h.db.query("update auth.users set raw_user_meta_data = '{\"name\": \"Carla Diaz\"}' where id = $1", [ids[4]]);
  await h.db.query("insert into app.email_optouts (email) values ('optedout@shop.example')");
}, 60_000);

describe("announcements", () => {
  it("counts only confirmed accounts that haven't unsubscribed", async () => {
    const d = await svc.getAnnouncementsData();
    expect(d).toMatchObject({ ready: true, recipients: 3, optOuts: 1 });
  });

  it("sends a personalised test to the admin with Reply-To, unsubscribe link and one-click headers", async () => {
    h.send.mockReset().mockResolvedValue(undefined);
    const r = await svc.sendAnnouncementTest({ subject: "Hi {{first_name}}", body: "Hello {{first_name}}, visit {{site}} for your {{trial_days}}-day trial." });
    expect(r).toEqual({ ok: true, to: "owner@locenti.com" });
    const [to, subject, text, opts] = h.send.mock.calls[0];
    expect(to).toBe("owner@locenti.com");
    expect(subject).toBe("[Test] Hi Owner");
    expect(text).toContain("Hello Owner, visit https://locenti.com for your 14-day trial.");
    // Nothing added to the text (owner's decision); opting out works through the one-click header.
    expect(text).toBe("Hello Owner, visit https://locenti.com for your 14-day trial.");
    expect(opts.headers["List-Unsubscribe"]).toMatch(/^<https:\/\/locenti\.com\/api\/updates\/unsubscribe\/\S+>, <mailto:hello@locenti\.com\?subject=unsubscribe>$/);
    expect(opts).toMatchObject({ replyTo: "hello@locenti.com", headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
  });

  it("needs confirmation, then sends to everyone eligible once, even if resumed", async () => {
    expect(await svc.startAnnouncement({ subject: "News", body: "Hello {{first_name}}, something new is here." })).toMatchObject({ ok: false });
    h.send.mockReset().mockResolvedValue(undefined);
    const started = await svc.startAnnouncement({ subject: "News", body: "Hello {{first_name}}, something new is here.", confirm: true });
    if (!started.ok) throw new Error(started.error);
    expect(started.total).toBe(3);
    const r = await svc.continueAnnouncement(started.id);
    expect(r).toMatchObject({ ok: true, sent: 3, failed: 0, remaining: 0, done: true });
    expect(h.send.mock.calls.map((c) => c[0]).sort()).toEqual(["ann.lee@agency.example", "bob@studio.example", "carla@bakery.example"]);
    expect(h.send.mock.calls.find((c) => c[0] === "carla@bakery.example")![2]).toContain("Hello Carla,");
    expect(h.send.mock.calls.find((c) => c[0] === "ann.lee@agency.example")![2]).toContain("Hello Ann,");
    // Running it again sends nothing.
    expect(await svc.continueAnnouncement(started.id)).toMatchObject({ sent: 0, done: true });
    expect(h.send).toHaveBeenCalledTimes(3);
  });

  it("pauses when the mailbox hits its limit, and resumes without repeats", async () => {
    let calls = 0;
    h.send.mockReset().mockImplementation(async () => {
      if (++calls === 2) throw new Error("Gmail's sending limit for this mailbox was reached.");
    });
    const started = await svc.startAnnouncement({ subject: "Tips", body: "Five tips for {{first_name}} today.", confirm: true });
    if (!started.ok) throw new Error(started.error);
    const first = await svc.continueAnnouncement(started.id);
    expect(first).toMatchObject({ ok: true, sent: 1, remaining: 2, done: false, note: expect.stringMatching(/limit/) });
    const second = await svc.continueAnnouncement(started.id);
    expect(second).toMatchObject({ sent: 2, remaining: 0, done: true });
    const to = h.send.mock.calls.map((c) => c[0]);
    expect(new Set(to.filter((_, i) => i !== 1)).size).toBe(3); // the refused one was retried, nobody got it twice
  });

  it("unsubscribes with a valid link only, and leaves them out next time", async () => {
    const { signUpdatesUnsubscribe } = await import("@/lib/updates-unsubscribe");
    expect(await svc.unsubscribeFromUpdates("forged.token.value")).toBe(false);
    const token = await signUpdatesUnsubscribe("Bob@Studio.example", process.env.SESSION_SECRET!);
    expect(await svc.peekUpdatesUnsubscribe(token)).toBe("bob@studio.example");
    expect(await svc.unsubscribeFromUpdates(token)).toBe(true);
    expect(await svc.unsubscribeFromUpdates(token)).toBe(true); // twice is fine
    expect((await svc.getAnnouncementsData()).recipients).toBe(2);
  });

  it("keeps short links from earlier emails working for the right person, and refuses a tampered one", async () => {
    const { shortUnsubscribeToken } = await import("@/lib/updates-unsubscribe");
    const token = shortUnsubscribeToken(ids[4], process.env.SESSION_SECRET!);
    expect(await svc.peekUpdatesUnsubscribe(token)).toBe("carla@bakery.example");
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(await svc.peekUpdatesUnsubscribe(tampered)).toBeNull();
    expect(await svc.unsubscribeFromUpdates(tampered)).toBe(false);
    expect(await svc.unsubscribeFromUpdates(token)).toBe(true);
    expect((await svc.getAnnouncementsData()).recipients).toBe(1);
  });

  it("posts a notification to every member's bell, once per key", async () => {
    await h.db.query("insert into public.workspaces (id, name) values ('00000000-0000-4000-8000-00000000ab01', 'Ann Co') on conflict do nothing");
    await h.db.query(`insert into public.memberships (workspace_id, user_id, role) values ('00000000-0000-4000-8000-00000000ab01', '${ids[0]}', 'owner'), ('00000000-0000-4000-8000-00000000ab01', '${ids[1]}', 'member') on conflict do nothing`);
    const n = { title: "Meet your AI assistant", body: "Click the chat button.", href: "/app/support", key: "ai-assistant" };
    expect(await svc.broadcastNotification(n)).toEqual({ ok: true, added: 2 });
    expect(await svc.broadcastNotification(n)).toEqual({ ok: true, added: 0 });
    const r = await h.db.query<{ kind: string; level: string; href: string }>("select kind, level, href from public.notifications where dedupe_key = 'announcement:ai-assistant'");
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ kind: "announcement", level: "info", href: "/app/support" });
    expect(await svc.broadcastNotification({ ...n, href: "https://evil.example" })).toMatchObject({ ok: false });
  });
});
