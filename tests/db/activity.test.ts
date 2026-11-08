import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { as, createTestDb, createUser } from "./harness";

/** The activity log (with outcomes), notifications for workspace members, and the admin feed built from both. */

const h = vi.hoisted(() => ({ db: null as unknown as PGlite }));
vi.mock("@/server/db", () => ({ withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db) }));

const { track, notifyWorkspace } = await import("@/server/events");
const admin = await import("@/server/admin-store");
const { listNotifications, markNotificationsRead, unreadCount } = await import("@/server/notification-store");

const OWNER = "00000000-0000-4000-8000-00000000a101";
const MEMBER = "00000000-0000-4000-8000-00000000a102";
const OTHER = "00000000-0000-4000-8000-00000000a103";
let ws: string;
let otherWs: string;
const q = () => h.db as unknown as Q;

beforeAll(async () => {
  h.db = await createTestDb();
  await createUser(h.db, OWNER, "owner@agency.example");
  await createUser(h.db, MEMBER, "member@agency.example");
  await createUser(h.db, OTHER, "other@studio.example");
  ws = await as(h.db, OWNER, async () => (await h.db.query<{ id: string }>("select public.create_workspace('Agency') as id")).rows[0].id);
  otherWs = await as(h.db, OTHER, async () => (await h.db.query<{ id: string }>("select public.create_workspace('Studio') as id")).rows[0].id);
  await h.db.query("insert into public.memberships (workspace_id, user_id, role) values ($1, $2, 'member')", [ws, MEMBER]);
}, 60_000);

describe("activity log", () => {
  it("records what happened, who did it and whether it went well", async () => {
    await track({ workspaceId: ws, userId: OWNER, kind: "mailbox_connected", area: "mailbox", outcome: "success", summary: "Connected Gmail mailbox sales@agency.example" });
    await track({ workspaceId: ws, userId: OWNER, kind: "mailbox_test_failed", area: "mailbox", outcome: "failed", summary: "Test email failed: Gmail API is turned off" });
    await track({ email: "stranger@x.example", kind: "signin_failed", area: "account", outcome: "failed", summary: "Sign-in failed: wrong email or password" });
    const rows = (await h.db.query<{ email: string; outcome: string }>("select email, outcome from app.activity_events order by id")).rows;
    expect(rows).toEqual([
      { email: "owner@agency.example", outcome: "success" }, // email filled in from the user
      { email: "owner@agency.example", outcome: "failed" },
      { email: "stranger@x.example", outcome: "failed" },
    ]);
  });

  it("never throws, even with bad input", async () => {
    await expect(track({ kind: "x", area: "nope" as never, outcome: "success", summary: "bad area" })).resolves.toBeUndefined();
  });

  it("is invisible to signed-in users", async () => {
    await expect(as(h.db, OWNER, () => h.db.query("select * from app.activity_events"))).rejects.toThrow(/permission denied/);
  });
});

describe("admin activity feed", () => {
  it("shows recorded events with their outcome, filters by area, and lists failures on their own", async () => {
    const all = await admin.activity(q(), "all", "");
    expect(all.find((r) => r.kind === "mailbox_test_failed")).toMatchObject({ outcome: "failed", workspace: "Agency" });
    expect(all.find((r) => r.kind === "signup")).toMatchObject({ outcome: "success" }); // records the app keeps anyway get one too
    const mailboxes = await admin.activity(q(), "mailboxes", "");
    expect(mailboxes.map((r) => r.kind).sort()).toEqual(["mailbox_connected", "mailbox_test_failed"]);
    const failed = await admin.activity(q(), "failed", "");
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((r) => r.outcome === "failed")).toBe(true);
    expect((await admin.activity(q(), "signins", "")).map((r) => r.kind)).toContain("signin_failed");
  });

  it("counts how the last 7 days went", async () => {
    const c = await admin.outcomeCounts(q());
    expect(c).toMatchObject({ recording: true });
    expect(c.success).toBeGreaterThanOrEqual(1);
    expect(c.failed).toBeGreaterThanOrEqual(2);
  });
});

describe("notifications", () => {
  it("goes to everyone in the workspace, to owners and admins only, or to one person", async () => {
    await track({ workspaceId: ws, kind: "campaign_launched", area: "campaign", outcome: "success", summary: "Launched", notify: { title: '"Austin" is live', href: "/app/campaigns/x" } });
    await track({ workspaceId: ws, kind: "mailbox_needs_reconnect", area: "mailbox", outcome: "failed", summary: "Lost access", notify: { title: "Reconnect sales@", to: "managers" } });
    await notifyWorkspace(ws, "role", { title: "Your role changed", to: { userId: MEMBER } });
    const owner = await as(h.db, OWNER, () => listNotifications(q(), ws));
    const member = await as(h.db, MEMBER, () => listNotifications(q(), ws));
    expect(owner.map((n) => n.title).sort()).toEqual(['"Austin" is live', "Reconnect sales@"]);
    expect(member.map((n) => n.title).sort()).toEqual(['"Austin" is live', "Your role changed"]);
    expect(owner.find((n) => n.title.startsWith("Reconnect"))).toMatchObject({ level: "failed", read: false });
  });

  it("stores the same thing once (dedupe key) and ignores links that leave the app", async () => {
    for (let i = 0; i < 3; i++) await notifyWorkspace(ws, "reply", { title: "New reply", dedupeKey: "reply:m1", href: "https://evil.example" });
    const owner = await as(h.db, OWNER, () => listNotifications(q(), ws));
    const replies = owner.filter((n) => n.title === "New reply");
    expect(replies).toHaveLength(1);
    expect(replies[0].href).toBeNull();
  });

  it("lets each person read and mark only their own", async () => {
    expect(await as(h.db, OWNER, () => unreadCount(q(), ws))).toBe(3);
    const first = (await as(h.db, OWNER, () => listNotifications(q(), ws)))[0];
    // Someone else can't mark it (or see it).
    expect(await as(h.db, MEMBER, () => markNotificationsRead(q(), ws, first.id))).toBe(0);
    expect(await as(h.db, OTHER, () => listNotifications(q(), ws))).toEqual([]);
    expect(await as(h.db, OWNER, () => markNotificationsRead(q(), ws, first.id))).toBe(1);
    expect(await as(h.db, OWNER, () => unreadCount(q(), ws))).toBe(2);
    expect(await as(h.db, OWNER, () => markNotificationsRead(q(), ws))).toBe(2);
    expect(await as(h.db, OWNER, () => listNotifications(q(), ws, { unreadOnly: true }))).toEqual([]);
    // Signed-in users can't create notifications themselves.
    await expect(as(h.db, OWNER, () => h.db.query("insert into public.notifications (workspace_id, user_id, kind, title) values ($1, $2, 'x', 'fake')", [ws, OWNER]))).rejects.toThrow(/permission denied/);
    expect(otherWs).toBeTruthy();
  });
});
