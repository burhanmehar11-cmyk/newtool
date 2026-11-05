import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { addSuppression, approveCampaign, createCampaign, getCampaign, saveDraft, setCampaignStatus, updateCampaignSettings } from "@/server/campaign-store";
import { upsertMailbox } from "@/server/mailbox-store";
import { recordInbound } from "@/server/replies-store";
import { as, createTestDb, createUser } from "./harness";

/**
 * The sending pass itself (runDispatch) against the real schema, with Gmail
 * replaced by a stub: what happens when the network drops mid-send, when a
 * mailbox loses access, when someone replies or a campaign is paused before
 * the next pass, and when an address is blocked between approval and sending.
 */

const h = vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  process.env.NEXT_PUBLIC_SITE_URL = "https://locenti.test";
  return {
    db: null as unknown as PGlite,
    send: vi.fn(),
    token: vi.fn(),
  };
});

vi.mock("@/server/db", () => ({ withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db) }));
vi.mock("@/server/gmail/google", () => ({ sendRaw: (...a: unknown[]) => h.send(...a) }));
vi.mock("@/server/services/mailboxes", () => ({ accessTokenFor: (...a: unknown[]) => h.token(...a) }));

const { runDispatch } = await import("@/server/services/dispatch");

const A = "00000000-0000-4000-8000-0000000000a7";
const ALWAYS = { timezone: "UTC", days: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 24 };
let db: PGlite;
let q: Q;
let ws: string;
let n = 0;

async function seedLead(email: string) {
  n++;
  return as(db, A, async () => {
    const b = (await db.query<{ id: string }>("insert into public.businesses (workspace_id, provider, provider_ref, name, collected_at) values ($1, 'openstreetmap', $2, $3, now()) returning id", [ws, `osm:d${n}`, `Shop ${n}`])).rows[0].id;
    await db.query("insert into public.contacts (workspace_id, business_id, email_normalized) values ($1, $2, $3)", [ws, b, email]);
    await db.query("insert into public.briefs (workspace_id, business_id, offer_type, payload, generator) values ($1, $2, 'web_design', '{}'::jsonb, 'template')", [ws, b]);
    const lead = (await db.query<{ id: string }>("insert into public.leads (workspace_id, business_id, source) values ($1, $2, 'search') returning id", [ws, b])).rows[0].id;
    await saveDraft(q, ws, A, lead, { subject: `Hello ${n}`, body: "A short, personal first email.", factIds: [], origin: "generated" });
    return lead;
  });
}

/** A running campaign on its own mailbox, with one queued email per address. */
async function runningCampaign(emails: string[]) {
  const mailbox = await as(db, A, () => upsertMailbox(q, ws, A, `box${n}@agency.example`, "Sam", "gmail.send"));
  const leadIds: string[] = [];
  for (const e of emails) leadIds.push(await seedLead(e));
  const id = await as(db, A, async () => {
    const c = await createCampaign(q, ws, A, { name: `C${n}`, schedule: ALWAYS, mailboxId: mailbox, leadIds });
    await updateCampaignSettings(q, c, { name: `C${n}`, mailboxId: mailbox, schedule: ALWAYS, policy: { includeUnknown: true, includeCatchAll: false } });
    return c;
  });
  const c = await as(db, A, () => getCampaign(q, id));
  await as(db, A, () => approveCampaign(q, ws, A, id, c!.revision));
  return { id, mailbox, leadIds };
}

const status = async (id: string) => (await as(db, A, () => getCampaign(q, id)))?.status;
const enrollments = async (campaign: string) =>
  (await db.query<{ email: string; state: string; reason: string | null }>("select email, state, reason from public.enrollments where campaign_id = $1 order by email", [campaign])).rows;
const dispatches = async (campaign: string) => (await db.query<{ status: string }>("select status from public.dispatches where campaign_id = $1", [campaign])).rows.map((r) => r.status);

/** Leaves only this campaign running, so each pass touches one campaign. */
async function only(id: string) {
  await db.query("update public.campaigns set status = 'cancelled' where workspace_id = $1 and status = 'running' and id <> $2", [ws, id]);
}

beforeAll(async () => {
  db = await createTestDb();
  h.db = db;
  q = db as unknown as Q;
  await createUser(db, A, "a@agency.example");
  ws = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency D') as id")).rows[0].id);
}, 60_000);

beforeEach(() => {
  h.send.mockReset();
  h.token.mockReset();
  h.token.mockResolvedValue({ ok: true, token: "access-token" });
  h.send.mockResolvedValue({ ok: true, id: `gm-${Math.random().toString(16).slice(2)}`, threadId: `th${Math.random().toString(16).slice(2, 12)}` });
});

describe("sending pass", () => {
  it("sends one approved email per mailbox per pass, with an unsubscribe link and header", async () => {
    const c = await runningCampaign(["one@shop1.example", "two@shop2.example"]);
    await only(c.id);
    expect((await runDispatch({ workspaceId: ws, ignoreGap: true })).sent).toBe(1);
    expect(h.send).toHaveBeenCalledTimes(1);
    const raw = Buffer.from(h.send.mock.calls[0][1] as string, "base64url").toString("utf8");
    expect(raw).toMatch(/List-Unsubscribe: <https:\/\/locenti\.test\/api\/unsubscribe\//);
    expect(raw).toMatch(/List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
    // The spacing rule holds the second email back until a later pass.
    expect((await runDispatch({ workspaceId: ws })).skipped.join()).toMatch(/spacing between emails/);
    expect((await runDispatch({ workspaceId: ws, ignoreGap: true })).sent).toBe(1);
    expect(await status(c.id)).toBe("completed");
    expect(h.send).toHaveBeenCalledTimes(2);
  });

  it("never retries an ambiguous send (network cut), so nobody gets the email twice", async () => {
    const c = await runningCampaign(["amb@shop.example"]);
    await only(c.id);
    h.send.mockResolvedValue({ ok: false, code: "network", message: "Couldn't reach Gmail." });
    expect((await runDispatch({ workspaceId: ws, ignoreGap: true })).failed).toBe(1);
    expect(await dispatches(c.id)).toEqual(["ambiguous"]);
    expect((await enrollments(c.id))[0]).toMatchObject({ state: "stopped", reason: expect.stringMatching(/Sent folder/) });
    // Later passes leave it alone.
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it("counts an ambiguous send against the daily limit", async () => {
    const c = await runningCampaign(["cap1@shop.example", "cap2@shop.example"]);
    await only(c.id);
    await db.query("update public.sending_accounts set daily_cap = 1 where id = $1", [c.mailbox]);
    h.send.mockResolvedValue({ ok: false, code: "network", message: "Couldn't reach Gmail." });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    const second = await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(second.skipped.join()).toMatch(/daily limit reached/);
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it("pauses and keeps the email queued when the mailbox loses access", async () => {
    const c = await runningCampaign(["revoked@shop.example"]);
    await only(c.id);
    h.send.mockResolvedValue({ ok: false, code: "auth", message: "Gmail rejected the mailbox's access. Reconnect it." });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(await status(c.id)).toBe("paused");
    expect(await dispatches(c.id)).toEqual([]); // claim released
    expect((await enrollments(c.id))[0].state).toBe("queued");
    const box = (await db.query<{ status: string }>("select status from public.sending_accounts where id = $1", [c.mailbox])).rows[0];
    expect(box.status).toBe("needs_reconnect");

    // Resumed while still disconnected: paused again before any send is tried.
    await as(db, A, () => setCampaignStatus(q, c.id, ["paused"], "running"));
    const r = await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(r.skipped.join()).toMatch(/mailbox not connected/);
    expect(await status(c.id)).toBe("paused");
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it("pauses without sending when the stored token can't be refreshed", async () => {
    const c = await runningCampaign(["token@shop.example"]);
    await only(c.id);
    h.token.mockResolvedValue({ ok: false, message: "Reconnect this mailbox", reconnect: true });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(h.send).not.toHaveBeenCalled();
    expect(await status(c.id)).toBe("paused");
    expect(await dispatches(c.id)).toEqual([]);
    expect((await enrollments(c.id))[0].state).toBe("queued");
  });

  it("stops the enrollment, but not the campaign, when Gmail rejects one email", async () => {
    const c = await runningCampaign(["bad@shop.example", "good@shop.example"]);
    await only(c.id);
    h.send.mockResolvedValueOnce({ ok: false, code: "rejected", message: "Gmail didn't accept the email (HTTP 400)." });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect((await dispatches(c.id)).sort()).toEqual(["accepted", "failed"]);
    expect(await status(c.id)).toBe("completed");
  });

  it("sends nothing from a paused campaign, and resumes where it left off", async () => {
    const c = await runningCampaign(["p1@shop.example", "p2@shop.example"]);
    await only(c.id);
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    await as(db, A, () => setCampaignStatus(q, c.id, ["running"], "paused"));
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(h.send).toHaveBeenCalledTimes(1);
    await as(db, A, () => setCampaignStatus(q, c.id, ["paused"], "running"));
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(h.send).toHaveBeenCalledTimes(2);
    expect((await enrollments(c.id)).map((e) => e.state)).toEqual(["sent", "sent"]);
  });

  it("doesn't email someone who replied before their turn came", async () => {
    const c = await runningCampaign(["r1@shop.example", "r2@shop.example"]);
    await only(c.id);
    // r2 answers first (say, to an earlier conversation threaded into this campaign).
    const thread = (await db.query<{ id: string }>("insert into public.threads (workspace_id, lead_id, campaign_id, provider_thread_id, subject) values ($1, $2, $3, 'thr-race', 'Re: hi') returning id", [ws, c.leadIds[1], c.id])).rows[0].id;
    await recordInbound(q, { ws, threadId: thread, messageId: "in-race", from: "r2@shop.example", to: "box@agency.example", subject: "Re: hi", text: "Not now, thanks.", at: new Date(), kind: "not_interested", classificationSource: "rules", leadId: c.leadIds[1], campaignId: c.id });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(h.send).toHaveBeenCalledTimes(1);
    const sentTo = Buffer.from(h.send.mock.calls[0][1] as string, "base64url").toString("utf8");
    expect(sentTo).toMatch(/To: r1@shop\.example/);
    expect((await enrollments(c.id)).find((e) => e.email === "r2@shop.example")?.state).toBe("replied");
    expect(await status(c.id)).toBe("completed");
  });

  it("checks the do-not-contact list again at send time", async () => {
    const c = await runningCampaign(["late@blocked.example"]);
    await only(c.id);
    // Blocked by domain after approval, bypassing the usual enrollment update (as a race would).
    await db.query("insert into public.suppression_entries (workspace_id, value, kind, reason) values ($1, 'blocked.example', 'domain', 'manual')", [ws]);
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(h.send).not.toHaveBeenCalled();
    expect(await dispatches(c.id)).toEqual(["cancelled"]);
    expect((await enrollments(c.id))[0]).toMatchObject({ state: "stopped", reason: "On the do-not-contact list" });
  });

  it("keeps a re-imported address blocked", async () => {
    await as(db, A, () => addSuppression(q, ws, A, "again@shop.example", "email", "unsubscribe"));
    const c = await runningCampaign(["again@shop.example", "fresh@shop.example"]).catch(() => null);
    // Approval leaves the blocked address out entirely.
    expect(c).not.toBeNull();
    const rows = await enrollments(c!.id);
    expect(rows.map((e) => e.email)).toEqual(["fresh@shop.example"]);
  });

  it("does nothing outside the sending window", async () => {
    const c = await runningCampaign(["night@shop.example"]);
    await only(c.id);
    await db.query("update public.campaigns set schedule = $2::jsonb where id = $1", [c.id, JSON.stringify({ ...ALWAYS, days: [] })]);
    const r = await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(r.skipped.join()).toMatch(/outside sending hours/);
    expect(h.send).not.toHaveBeenCalled();
  });
});
