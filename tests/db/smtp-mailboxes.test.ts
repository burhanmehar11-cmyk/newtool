import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { approveCampaign, createCampaign, getCampaign, saveDraft, updateCampaignSettings } from "@/server/campaign-store";
import { as, createTestDb, createUser } from "./harness";

/**
 * App Password mailboxes (SMTP to send, IMAP for replies), end to end against
 * the real schema with the mail servers replaced by stubs: connecting checks
 * the login and stores the password encrypted, campaigns send over SMTP with
 * our own Message-ID, and replies found over IMAP land in the right thread.
 */

const A = "00000000-0000-4000-8000-0000000000c1";
const h = vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  process.env.NEXT_PUBLIC_SITE_URL = "https://locenti.test";
  return {
    db: null as unknown as PGlite,
    ws: "",
    verifySmtp: vi.fn(),
    verifyImap: vi.fn(),
    sendSmtp: vi.fn(),
    findReplies: vi.fn(),
    lookup: vi.fn(),
  };
});

vi.mock("@/server/db", async () => {
  const { as } = await import("./harness");
  return {
    withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db),
    withUser: (u: string, fn: (q: unknown) => Promise<unknown>) => as(h.db, u, () => fn(h.db)),
  };
});
vi.mock("@/server/auth", () => ({
  requireWorkspace: async () => ({ user: { id: A, email: "a@agency.example" }, workspace: { id: h.ws, role: "owner", name: "Agency S" } }),
  requireUser: async () => ({ id: A }),
  isViewer: () => false,
  VIEW_ONLY: "View only",
}));
vi.mock("@/server/mail/client", async (orig) => ({
  ...(await orig<typeof import("@/server/mail/client")>()),
  verifySmtp: (...a: unknown[]) => h.verifySmtp(...a),
  verifyImap: (...a: unknown[]) => h.verifyImap(...a),
  sendSmtp: (...a: unknown[]) => h.sendSmtp(...a),
  findReplies: (...a: unknown[]) => h.findReplies(...a),
}));
vi.mock("node:dns/promises", () => ({ lookup: (...a: unknown[]) => h.lookup(...a), default: { lookup: (...a: unknown[]) => h.lookup(...a) } }));

const mailboxes = await import("@/server/services/mailboxes");
const { runDispatch } = await import("@/server/services/dispatch");
const { syncWorkspaceReplies } = await import("@/server/services/replies");

let db: PGlite;
let q: Q;
const ALWAYS = { timezone: "UTC", days: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 24 };
const google = { preset: "google", email: "Sam@Agency.example", senderName: "Sam", password: "abcd efgh ijkl mnop" };

beforeAll(async () => {
  db = await createTestDb();
  h.db = db;
  q = db as unknown as Q;
  await createUser(db, A, "a@agency.example");
  h.ws = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency S') as id")).rows[0].id);
}, 60_000);

beforeEach(() => {
  for (const f of [h.verifySmtp, h.verifyImap, h.sendSmtp, h.findReplies, h.lookup]) f.mockReset();
  h.verifySmtp.mockResolvedValue({ ok: true });
  h.verifyImap.mockResolvedValue({ ok: true });
  h.sendSmtp.mockResolvedValue({ ok: true });
  h.lookup.mockResolvedValue([{ address: "142.250.102.108", family: 4 }]);
});

describe("connecting a mailbox with an App Password", () => {
  it("checks the login, fills in Google's servers and stores the password encrypted", async () => {
    const r = await mailboxes.addSmtpMailbox(google);
    expect(r).toMatchObject({ ok: true, email: "sam@agency.example", replies: true, note: null });
    expect(h.verifySmtp).toHaveBeenCalledWith({ host: "smtp.gmail.com", port: 465, secure: true }, { user: "sam@agency.example", pass: "abcdefghijklmnop" });
    expect(h.verifyImap).toHaveBeenCalledWith({ host: "imap.gmail.com", port: 993, secure: true }, expect.anything());
    const row = (await db.query<Record<string, unknown>>("select provider, preset, smtp_host, imap_host, scopes, status, sender_name from public.sending_accounts where email = 'sam@agency.example'")).rows[0];
    expect(row).toMatchObject({ provider: "smtp", preset: "google", smtp_host: "smtp.gmail.com", imap_host: "imap.gmail.com", scopes: "imap", status: "connected", sender_name: "Sam" });
    const secret = (await db.query<{ encrypted_tokens: Uint8Array }>("select s.encrypted_tokens from public.sending_account_secrets s join public.sending_accounts a on a.id = s.account_id where a.email = 'sam@agency.example'")).rows[0];
    expect(Buffer.from(secret.encrypted_tokens).toString("utf8")).not.toContain("abcdefghijklmnop");
  });

  it("says what's wrong and saves nothing when the App Password is refused", async () => {
    h.verifySmtp.mockResolvedValue({ ok: false, code: "auth", message: "Google didn't accept the email address and App Password." });
    expect(await mailboxes.addSmtpMailbox({ ...google, email: "wrong@agency.example" })).toMatchObject({ ok: false, error: expect.stringMatching(/App Password/) });
    expect((await db.query("select 1 from public.sending_accounts where email = 'wrong@agency.example'")).rows).toHaveLength(0);
  });

  it("connects for sending with reply tracking off when IMAP doesn't work", async () => {
    h.verifyImap.mockResolvedValue({ ok: false, code: "imap_off", message: "IMAP is turned off for this Gmail account." });
    expect(await mailboxes.addSmtpMailbox({ ...google, email: "noimap@agency.example" })).toMatchObject({ ok: true, replies: false, note: expect.stringMatching(/IMAP is turned off/) });
    expect((await db.query<{ scopes: string; imap_host: string | null }>("select scopes, imap_host from public.sending_accounts where email = 'noimap@agency.example'")).rows[0]).toEqual({ scopes: "", imap_host: null });
  });

  it("only talks to public mail servers on mail ports", async () => {
    const custom = { preset: "custom", email: "me@shop.example", password: "pw", smtp: { host: "mail.shop.example", port: 465, secure: true }, imap: null };
    expect(await mailboxes.testMailboxConnection({ ...custom, smtp: { host: "mail.shop.example", port: 22, secure: true } })).toMatchObject({ ok: false, error: expect.stringMatching(/465/) });
    h.lookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    expect(await mailboxes.testMailboxConnection(custom)).toMatchObject({ ok: false, error: expect.stringMatching(/isn't a public mail server/) });
    h.lookup.mockResolvedValue([]);
    expect(await mailboxes.testMailboxConnection(custom)).toMatchObject({ ok: false, error: expect.stringMatching(/Couldn't find the server/) });
    expect(h.verifySmtp).not.toHaveBeenCalled();
  });
});

describe("sending and replies over SMTP/IMAP", () => {
  it("sends a campaign email over SMTP and files the IMAP reply in its thread", async () => {
    const box = (await db.query<{ id: string }>("select id from public.sending_accounts where email = 'sam@agency.example'")).rows[0].id;
    const ws = h.ws;
    const lead = await as(db, A, async () => {
      const b = (await db.query<{ id: string }>("insert into public.businesses (workspace_id, provider, provider_ref, name, collected_at) values ($1, 'openstreetmap', 'osm:s1', 'Shop S', now()) returning id", [ws])).rows[0].id;
      await db.query("insert into public.contacts (workspace_id, business_id, email_normalized) values ($1, $2, 'owner@shop-s.example')", [ws, b]);
      await db.query("insert into public.briefs (workspace_id, business_id, offer_type, payload, generator) values ($1, $2, 'web_design', '{}'::jsonb, 'template')", [ws, b]);
      const l = (await db.query<{ id: string }>("insert into public.leads (workspace_id, business_id, source) values ($1, $2, 'search') returning id", [ws, b])).rows[0].id;
      await saveDraft(q, ws, A, l, { subject: "Quick idea for Shop S", body: "A short, personal first email.", factIds: [], origin: "generated" });
      return l;
    });
    const campaign = await as(db, A, async () => {
      const c = await createCampaign(q, ws, A, { name: "SMTP", schedule: ALWAYS, mailboxId: box, leadIds: [lead] });
      await updateCampaignSettings(q, c, { name: "SMTP", mailboxId: box, schedule: ALWAYS, policy: { includeUnknown: true, includeCatchAll: false } });
      const x = await getCampaign(q, c);
      await approveCampaign(q, ws, A, c, x!.revision);
      return c;
    });

    expect((await runDispatch({ workspaceId: ws, ignoreGap: true })).sent).toBe(1);
    const [server, login, msg] = h.sendSmtp.mock.calls[0] as [{ host: string }, { pass: string }, { from: string; to: string; raw: string }];
    expect(server.host).toBe("smtp.gmail.com");
    expect(login.pass).toBe("abcdefghijklmnop");
    expect(msg).toMatchObject({ from: "sam@agency.example", to: "owner@shop-s.example" });
    expect(msg.raw).toMatch(/^Date: .+GMT$/m);
    const rfc = /^Message-ID: (<[^>]+>)$/m.exec(msg.raw)![1];
    const d = (await db.query<{ status: string; provider_message_id: string; rfc_message_id: string }>("select status, provider_message_id, rfc_message_id from public.dispatches where campaign_id = $1", [campaign])).rows[0];
    expect(d).toEqual({ status: "accepted", provider_message_id: rfc.toLowerCase(), rfc_message_id: rfc });

    h.findReplies.mockResolvedValue({
      ok: true,
      replies: [{ id: "<reply-1@shop-s.example>", from: "Owner <owner@shop-s.example>", fromEmail: "owner@shop-s.example", to: "sam@agency.example", subject: "Re: Quick idea for Shop S", date: new Date(), text: "Sounds interesting, can we talk on Thursday?", autoSubmitted: false, refs: [rfc.toLowerCase()] }],
    });
    const s = await syncWorkspaceReplies(ws, true);
    expect(s).toMatchObject({ newReplies: 1 });
    const [, , findArgs] = h.findReplies.mock.calls[0] as [unknown, unknown, { ours: Set<string>; self: string }];
    expect(findArgs.ours.has(rfc.toLowerCase())).toBe(true);
    expect(findArgs.self).toBe("sam@agency.example");
    const inbound = (await db.query<{ body_text: string }>("select m.body_text from public.messages m join public.threads t on t.id = m.thread_id where t.campaign_id = $1 and m.direction = 'inbound'", [campaign])).rows;
    expect(inbound).toEqual([{ body_text: "Sounds interesting, can we talk on Thursday?" }]);
    expect((await db.query<{ state: string }>("select state from public.enrollments where campaign_id = $1", [campaign])).rows[0].state).toBe("replied");
    // Seen again on the next check: not saved twice.
    expect(await syncWorkspaceReplies(ws, true)).toMatchObject({ newReplies: 0 });
  });

  it("reports a refused password as an auth problem (so the campaign pauses and asks for a new one)", async () => {
    const box = (await db.query<{ id: string }>("select id from public.sending_accounts where email = 'sam@agency.example'")).rows[0].id;
    h.verifySmtp.mockResolvedValue({ ok: false, code: "auth", message: "refused" });
    const sender = await mailboxes.mailboxSender(box);
    expect(sender.ok).toBe(true);
    h.sendSmtp.mockResolvedValue({ ok: false, code: "auth", message: "Google didn't accept the email address and App Password." });
    const r = sender.ok ? await sender.send({ message: "x", rfcMessageId: "<a@b>", from: "sam@agency.example", to: "x@y.example" }) : null;
    expect(r).toMatchObject({ ok: false, code: "auth" });
  });
});
