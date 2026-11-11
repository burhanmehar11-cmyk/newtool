import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { as, createTestDb, createUser } from "./harness";

/** The private support API: handle a request by its ticket number with the admin token. */

const TOKEN = "s".repeat(40);
const h = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://locenti.com";
  process.env.ADMIN_EMAILS = "owner@locenti.example";
  return { db: null as unknown as PGlite, as: null as unknown as typeof import("./harness").as, send: vi.fn() };
});
vi.mock("@/server/db", () => ({
  withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db),
  withUser: (userId: string, fn: (q: unknown) => Promise<unknown>) => h.as(h.db, userId, () => fn(h.db)),
}));
vi.mock("@/server/auth", () => ({
  requireUser: async () => ({ id: "00000000-0000-4000-8000-0000000b0001", email: "ann@agency.example", sessionId: "s" }),
  requireWorkspace: async () => { throw new Error("unused"); },
  getActiveWorkspace: async () => null,
}));
vi.mock("@/server/services/admin", () => ({ requireAdmin: async () => { throw new Error("no session"); } }));
vi.mock("@/server/email", () => ({ sendEmail: (...a: unknown[]) => h.send(...a) }));

const route = await import("@/app/api/admin/support/route");
const support = await import("@/server/services/support");
const req = (method: string, path: string, body?: unknown, token: string | null = TOKEN) =>
  new NextRequest(`https://locenti.com/api/admin/support${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

beforeAll(async () => {
  h.db = await createTestDb();
  h.as = as;
  process.env.ADMIN_API_TOKEN = TOKEN;
  await createUser(h.db, "00000000-0000-4000-8000-0000000b0001", "ann@agency.example");
  h.send.mockResolvedValue(undefined);
  await support.openSupportRequest({ subject: "Can't find my leads", topic: "search", body: "They disappeared after a search." });
}, 60_000);

describe("admin support API", () => {
  it("refuses without the token", async () => {
    expect((await route.GET(req("GET", "", undefined, null))).status).toBe(401);
    expect((await route.GET(req("GET", "", undefined, "x".repeat(40)))).status).toBe(401);
  });

  it("lists the queue and opens a request by number", async () => {
    const q = await (await route.GET(req("GET", ""))).json();
    expect(q).toMatchObject({ ok: true, counts: { needsReply: 1 }, queue: [{ ref: "LOC-1001", subject: "Can't find my leads", email: "ann@agency.example" }] });
    const t = await (await route.GET(req("GET", "?ref=LOC-1001"))).json();
    expect(t).toMatchObject({ ok: true, ticket: { ref: "LOC-1001", status: "needs_reply" }, messages: [{ from: "ann@agency.example", body: "They disappeared after a search." }], customer: { email: "ann@agency.example" } });
    expect((await route.GET(req("GET", "?ref=LOC-9999"))).status).toBe(404);
  });

  it("replies, adds a note and resolves by number", async () => {
    h.send.mockClear();
    expect(await (await route.POST(req("POST", "", { action: "note", ref: "1001", body: "Checked their workspace." }))).json()).toEqual({ ok: true });
    expect(h.send).not.toHaveBeenCalled();
    expect(await (await route.POST(req("POST", "", { action: "reply", ref: "LOC-1001", body: "Your leads are in Leads → All; a filter was on." }))).json()).toEqual({ ok: true });
    expect(h.send.mock.calls[0].slice(0, 2)).toEqual(["ann@agency.example", "Re: [LOC-1001] Can't find my leads"]);
    expect(await (await route.POST(req("POST", "", { action: "status", ref: "LOC-1001", status: "resolved" }))).json()).toEqual({ ok: true });
    const t = await (await route.GET(req("GET", "?ref=LOC-1001"))).json();
    expect(t.ticket.status).toBe("resolved");
    expect(t.messages.map((m: { from: string }) => m.from)).toEqual(["ann@agency.example", "note:owner@locenti.example", "team"]);
  });
});
