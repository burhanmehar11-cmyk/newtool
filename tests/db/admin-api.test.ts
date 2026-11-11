import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { createTestDb, createUser } from "./harness";

/** The private announcements API: token required, announcements only, sends from hello@locenti.com. */

const TOKEN = "t".repeat(40);
const h = vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  process.env.NEXT_PUBLIC_SITE_URL = "https://locenti.com";
  process.env.ADMIN_EMAILS = "owner@locenti.example";
  return { db: null as unknown as PGlite, send: vi.fn() };
});
vi.mock("@/server/db", () => ({ withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db) }));
vi.mock("@/server/services/admin", () => ({ requireAdmin: async () => { throw new Error("no session here"); } }));
vi.mock("@/server/email", () => ({ emailChannel: async () => ({ kind: "gmail", email: "owner@gmail.example" }), sendEmail: (...a: unknown[]) => h.send(...a) }));

const route = await import("@/app/api/admin/announcements/route");
const req = (method: string, body?: unknown, token: string | null = TOKEN) =>
  new NextRequest("https://locenti.com/api/admin/announcements", { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

beforeAll(async () => {
  h.db = await createTestDb();
  await createUser(h.db, "00000000-0000-4000-8000-0000000d0001", "ann@agency.example");
  await createUser(h.db, "00000000-0000-4000-8000-0000000d0002", "bob@studio.example");
}, 60_000);

describe("admin announcements API", () => {
  it("refuses without the right token, or when no token is configured", async () => {
    delete process.env.ADMIN_API_TOKEN;
    expect((await route.GET(req("GET"))).status).toBe(401);
    process.env.ADMIN_API_TOKEN = "short";
    expect((await route.GET(req("GET", undefined, "short"))).status).toBe(401); // too short to be safe
    process.env.ADMIN_API_TOKEN = TOKEN;
    expect((await route.GET(req("GET", undefined, null))).status).toBe(401);
    expect((await route.GET(req("GET", undefined, "x".repeat(40)))).status).toBe(401);
  });

  it("shows templates, recipients and that it sends from hello@locenti.com", async () => {
    const r = await (await route.GET(req("GET"))).json();
    expect(r).toMatchObject({ ok: true, ready: true, recipients: 2, sender: { from: "hello@locenti.com", replyTo: "hello@locenti.com" } });
    expect(r.templates.map((t: { id: string }) => t.id)).toContain("first-campaign");
  });

  it("sends a test to the owner from a template", async () => {
    h.send.mockReset().mockResolvedValue(undefined);
    const r = await (await route.POST(req("POST", { action: "test", template: "first-campaign" }))).json();
    expect(r).toEqual({ ok: true, to: "owner@locenti.example" });
    const [to, subject, , opts] = h.send.mock.calls[0];
    expect(to).toBe("owner@locenti.example");
    expect(subject).toBe("[Test] Your first Locenti campaign, in about 10 minutes");
    expect(opts).toMatchObject({ from: "hello@locenti.com", replyTo: "hello@locenti.com" });
  });

  it("needs confirm:true, then sends to everyone once", async () => {
    expect((await route.POST(req("POST", { action: "send", template: "trial" }))).status).toBe(400);
    h.send.mockReset().mockResolvedValue(undefined);
    const r = await (await route.POST(req("POST", { action: "send", template: "trial", confirm: true }))).json();
    expect(r).toMatchObject({ ok: true, total: 2, sent: 2, failed: 0, remaining: 0, done: true });
    expect(h.send.mock.calls.map((c) => c[0]).sort()).toEqual(["ann@agency.example", "bob@studio.example"]);
    expect(await (await route.POST(req("POST", { action: "continue", id: r.id }))).json()).toMatchObject({ ok: true, sent: 0, done: true });
  });
});
