import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, createUser } from "./harness";

/** Admin access from the panel: owners (ADMIN_EMAILS) add and remove admins; added admins get the panel and can sign in. */

const h = vi.hoisted(() => {
  process.env.ADMIN_EMAILS = "owner@locenti.example";
  process.env.NEXT_PUBLIC_SITE_URL = "https://locenti.com";
  return { db: null as unknown as PGlite, me: "owner@locenti.example", send: vi.fn() };
});
vi.mock("@/server/db", () => ({ withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db) }));
vi.mock("@/server/auth", () => ({
  requireUser: async () => ({ id: "u", email: h.me, sessionId: "s" }),
  getCurrentUser: async () => ({ id: "u", email: h.me, sessionId: "s" }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/server/email", () => ({ sendEmail: (...a: unknown[]) => h.send(...a), emailChannel: async () => ({ kind: "none" }) }));

const admin = await import("@/server/services/admin");
const access = await import("@/server/admin-access");
const { mayUseLocenti } = await import("@/server/access");

beforeAll(async () => {
  h.db = await createTestDb();
  await createUser(h.db, "00000000-0000-4000-8000-0000000a0001", "owner@locenti.example");
}, 60_000);

describe("admin access", () => {
  it("keeps everyone else out of the panel", async () => {
    h.me = "sam@shop.example";
    await expect(admin.requireAdmin()).rejects.toThrow("NOT_FOUND");
    expect(await admin.isAdmin()).toBe(false);
  });

  it("lets an owner add an admin, who is emailed and can then open the panel and sign in", async () => {
    h.me = "owner@locenti.example";
    h.send.mockReset().mockResolvedValue(undefined);
    expect(await admin.addPlatformAdmin("Sam@Shop.example")).toEqual({ ok: true, emailed: true });
    expect(h.send.mock.calls[0][0]).toBe("sam@shop.example");
    expect(h.send.mock.calls[0][2]).toContain("https://locenti.com/admin");
    expect(await admin.addPlatformAdmin("sam@shop.example")).toMatchObject({ ok: false, error: expect.stringMatching(/already an admin/) });
    expect(await admin.addPlatformAdmin("owner@locenti.example")).toMatchObject({ ok: false, error: expect.stringMatching(/already an owner/) });
    h.me = "sam@shop.example";
    await expect(admin.requireAdmin()).resolves.toMatchObject({ email: "sam@shop.example" });
    expect(await mayUseLocenti("sam@shop.example")).toBe(true);
    expect(await access.allAdminEmails()).toEqual(["owner@locenti.example", "sam@shop.example"]);
  });

  it("doesn't let an added admin manage admins, and shows the list with roles", async () => {
    h.me = "sam@shop.example";
    expect(await admin.addPlatformAdmin("eve@shop.example")).toMatchObject({ ok: false, error: expect.stringMatching(/Only owners/) });
    expect(await admin.removePlatformAdmin("sam@shop.example")).toMatchObject({ ok: false });
    const d = await admin.getAdminTab("admins", 30, "");
    if (d.tab !== "admins") throw new Error("wrong tab");
    expect(d.canManage).toBe(false);
    expect(d.admins.map((a) => [a.email, a.owner])).toEqual([["owner@locenti.example", true], ["sam@shop.example", false]]);
  });

  it("lets an owner remove an admin (never an owner), and records both changes", async () => {
    h.me = "owner@locenti.example";
    expect(await admin.removePlatformAdmin("owner@locenti.example")).toMatchObject({ ok: false, error: expect.stringMatching(/ADMIN_EMAILS/) });
    expect(await admin.removePlatformAdmin("sam@shop.example")).toEqual({ ok: true });
    h.me = "sam@shop.example";
    await expect(admin.requireAdmin()).rejects.toThrow("NOT_FOUND");
    const audit = (await h.db.query<{ action: string; target: string }>("select action, target from app.admin_audit order by created_at")).rows;
    expect(audit).toEqual([{ action: "grant_admin", target: "sam@shop.example" }, { action: "revoke_admin", target: "sam@shop.example" }]);
  });
});
