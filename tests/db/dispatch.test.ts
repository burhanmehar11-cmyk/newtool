import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { addSuppression, approveCampaign, createCampaign, getCampaign, saveDraft, saveFollowUps, setCampaignStatus, updateCampaignSettings } from "@/server/campaign-store";
import type { FollowUp } from "@/lib/campaigns/followups";
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
async function runningCampaign(emails: string[], followUps: FollowUp[] = []) {
  const mailbox = await as(db, A, () => upsertMailbox(q, ws, A, `box${n}@agency.example`, "Sam", "gmail.send"));
  const leadIds: string[] = [];
  for (const e of emails) leadIds.push(await seedLead(e));
  const id = await as(db, A, async () => {
    const c = await createCampaign(q, ws, A, { name: `C${n}`, schedule: ALWAYS, mailboxId: mailbox, leadIds });
    await updateCampaignSettings(q, c, { name: `C${n}`, mailboxId: mailbox, schedule: ALWAYS, policy: { includeUnknown: true, includeCatchAll: false } });
    if (followUps.length) await saveFollowUps(q, ws, c, followUps);
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

  it("pauses but keeps the mailbox connected when the Gmail API is turned off in the project", async () => {
    const c = await runningCampaign(["apioff@shop.example"]);
    await only(c.id);
    h.send.mockResolvedValue({ ok: false, code: "api_disabled", message: "The Gmail API is turned off in your Google Cloud project." });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(await status(c.id)).toBe("paused");
    expect(await dispatches(c.id)).toEqual([]);
    expect((await enrollments(c.id))[0].state).toBe("queued");
    const box = (await db.query<{ status: string; last_error: string }>("select status, last_error from public.sending_accounts where id = $1", [c.mailbox])).rows[0];
    expect(box).toMatchObject({ status: "connected", last_error: expect.stringMatching(/Gmail API is turned off/) });
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

describe("follow-ups", () => {
  const FU: FollowUp[] = [
    { delayDays: 3, body: "Just checking this reached {business}. {sender}" },
    { delayDays: 4, body: "Last note from me for {business}, no more after this." },
  ];
  const decode = (i: number) => Buffer.from(h.send.mock.calls[i][1] as string, "base64url").toString("utf8");
  const makeDue = (campaign: string) => db.query("update public.enrollments set next_send_at = now() - interval '1 minute' where campaign_id = $1 and next_send_at is not null", [campaign]);
  const enr = async (campaign: string) => (await db.query<{ state: string; step: number; next_send_at: Date | null; reason: string | null }>("select state, step, next_send_at, reason from public.enrollments where campaign_id = $1", [campaign])).rows[0];

  it("waits the set days, then replies in the same thread, and completes after the last one", async () => {
    const c = await runningCampaign(["fu@shop.example"], FU);
    await only(c.id);
    h.send.mockResolvedValueOnce({ ok: true, id: "gm-first", threadId: "thread0001" });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    const first = decode(0);
    const firstId = /Message-ID: (<[^>]+>)/.exec(first)?.[1];
    expect(firstId).toMatch(/@agency\.example>$/);
    let e = await enr(c.id);
    expect(e).toMatchObject({ state: "sent", step: 1 });
    const waitDays = (e.next_send_at!.getTime() - Date.now()) / 86_400_000;
    expect(waitDays).toBeGreaterThan(2.9);
    expect(waitDays).toBeLessThan(3.1);
    expect(await status(c.id)).toBe("running"); // a follow-up is waiting

    // Not due yet: nothing goes out.
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(h.send).toHaveBeenCalledTimes(1);

    await makeDue(c.id);
    h.send.mockResolvedValueOnce({ ok: true, id: "gm-fu1", threadId: "thread0001" });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(h.send).toHaveBeenCalledTimes(2);
    expect(h.send.mock.calls[1][2]).toBe("thread0001");
    const fu1 = decode(1);
    expect(fu1).toMatch(/Subject: Re: Hello \d+/);
    expect(fu1).toContain(`In-Reply-To: ${firstId}`);
    expect(fu1).toContain(`References: ${firstId}`);
    const fu1Body = Buffer.from(fu1.split("\r\n\r\n")[1].replace(/\r\n/g, ""), "base64").toString("utf8");
    expect(fu1Body).toMatch(/^Just checking this reached Shop \d+\. Sam/);
    expect(fu1Body).toMatch(/unsubscribe/i);
    e = await enr(c.id);
    expect(e).toMatchObject({ state: "sent", step: 2 });

    await makeDue(c.id);
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(h.send).toHaveBeenCalledTimes(3);
    expect(decode(2)).toContain("References: " + firstId); // threads back to the first email
    e = await enr(c.id);
    expect(e).toMatchObject({ state: "sent", step: 2, next_send_at: null });
    expect(await status(c.id)).toBe("completed");
    expect((await db.query<{ n: number }>("select count(*)::int as n from public.threads where provider_thread_id = 'thread0001'")).rows[0].n).toBe(1);
  });

  it("stops when the person replies", async () => {
    const c = await runningCampaign(["fureply@shop.example"], FU);
    await only(c.id);
    h.send.mockResolvedValueOnce({ ok: true, id: "gm-r1", threadId: "thread0002" });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    const thread = (await db.query<{ id: string }>("select id from public.threads where provider_thread_id = 'thread0002'")).rows[0].id;
    await recordInbound(q, { ws, threadId: thread, messageId: "in-fu", from: "fureply@shop.example", to: "box@agency.example", subject: "Re: Hello", text: "Sounds good, call me.", at: new Date(), kind: "interested", classificationSource: "rules", leadId: c.leadIds[0], campaignId: c.id });
    await makeDue(c.id);
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(h.send).toHaveBeenCalledTimes(1);
    expect((await enr(c.id)).state).toBe("replied");
  });

  it("doesn't stop for an out-of-office reply", async () => {
    const c = await runningCampaign(["fuooo@shop.example"], FU.slice(0, 1));
    await only(c.id);
    h.send.mockResolvedValueOnce({ ok: true, id: "gm-o1", threadId: "thread0003" });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    const thread = (await db.query<{ id: string }>("select id from public.threads where provider_thread_id = 'thread0003'")).rows[0].id;
    await recordInbound(q, { ws, threadId: thread, messageId: "in-ooo", from: "fuooo@shop.example", to: "box@agency.example", subject: "Auto: away", text: "I'm away until Monday.", at: new Date(), kind: "out_of_office", classificationSource: "rules", leadId: c.leadIds[0], campaignId: c.id });
    await makeDue(c.id);
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(h.send).toHaveBeenCalledTimes(2);
  });

  it("stops for an unsubscribe without changing what was sent", async () => {
    const c = await runningCampaign(["fuunsub@shop.example"], FU);
    await only(c.id);
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    await as(db, A, () => addSuppression(q, ws, null, "fuunsub@shop.example", "email", "unsubscribe"));
    expect(await enr(c.id)).toMatchObject({ state: "sent", next_send_at: null, reason: "On the do-not-contact list" });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(await status(c.id)).toBe("completed");
  });

  it("stops further follow-ups after a failed one, keeping the enrollment 'sent'", async () => {
    const c = await runningCampaign(["fufail@shop.example"], FU);
    await only(c.id);
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    await makeDue(c.id);
    h.send.mockResolvedValueOnce({ ok: false, code: "network", message: "Couldn't reach Gmail." });
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    expect(await enr(c.id)).toMatchObject({ state: "sent", step: 1, next_send_at: null, reason: expect.stringMatching(/^Follow-up stopped/) });
    await runDispatch({ workspaceId: ws, ignoreGap: true }); // the next pass finds nothing left
    expect(h.send).toHaveBeenCalledTimes(2);
    expect(await status(c.id)).toBe("completed");
  });

  it("cancelling a campaign drops waiting follow-ups", async () => {
    const c = await runningCampaign(["fucancel@shop.example"], FU);
    await only(c.id);
    await runDispatch({ workspaceId: ws, ignoreGap: true });
    await as(db, A, () => setCampaignStatus(q, c.id, ["running"], "cancelled"));
    expect(await enr(c.id)).toMatchObject({ state: "sent", next_send_at: null, reason: "Campaign cancelled" });
  });

  it("can only be changed while the campaign is a draft", async () => {
    const c = await runningCampaign(["fulocked@shop.example"], FU);
    expect(await as(db, A, () => saveFollowUps(q, ws, c.id, []))).toBe(false);
    expect((await db.query<{ n: number }>("select count(*)::int as n from public.campaign_steps where campaign_id = $1 and kind = 'follow_up'", [c.id])).rows[0].n).toBe(2);
  });
});
