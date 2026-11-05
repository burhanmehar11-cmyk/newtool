import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { recordAccepted, claimDispatch } from "@/server/dispatch-store";
import { inboxThreads, recordInbound, setThreadState, threadsForMailbox } from "@/server/replies-store";
import { as, createTestDb, createUser } from "./harness";

const A = "00000000-0000-4000-8000-0000000000a6";
const B = "00000000-0000-4000-8000-0000000000b6";
let db: PGlite;
let q: Q;
let ws: string;
let box: string;
let thread: string;
let campaign: string;
let lead: string;

beforeAll(async () => {
  db = await createTestDb();
  q = db as unknown as Q;
  await createUser(db, A, "a@agency.example");
  await createUser(db, B, "b@agency.example");
  ws = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency A') as id")).rows[0].id);
  await as(db, B, () => db.query("select public.create_workspace('Agency B')"));
  const one = async <T,>(sql: string, p: unknown[]) => (await db.query<T>(sql, p)).rows[0];
  box = (await one<{ id: string }>("insert into public.sending_accounts (workspace_id, provider, email) values ($1, 'gmail', 'sam@agency.example') returning id", [ws])).id;
  const biz = (await one<{ id: string }>("insert into public.businesses (workspace_id, provider, provider_ref, name, collected_at) values ($1, 'x', 'r1', 'Clinic', now()) returning id", [ws])).id;
  const contact = (await one<{ id: string }>("insert into public.contacts (workspace_id, business_id, email_normalized) values ($1, $2, 'info@clinic.example') returning id", [ws, biz])).id;
  lead = (await one<{ id: string }>("insert into public.leads (workspace_id, business_id, source) values ($1, $2, 'search') returning id", [ws, biz])).id;
  const draft = (await one<{ id: string }>("insert into public.drafts (workspace_id, lead_id, version, subject, body, origin) values ($1, $2, 1, 'Hi', 'Body text for the email.', 'edited') returning id", [ws, lead])).id;
  campaign = (await one<{ id: string }>("insert into public.campaigns (workspace_id, name, status, sending_account_id, schedule) values ($1, 'C1', 'running', $2, '{}'::jsonb) returning id", [ws, box])).id;
  const enr = (await one<{ id: string }>("insert into public.enrollments (workspace_id, campaign_id, lead_id, contact_id, email, draft_id, state) values ($1, $2, $3, $4, 'info@clinic.example', $5, 'queued') returning id", [ws, campaign, lead, contact, draft])).id;
  const d = await claimDispatch(q, ws, campaign, enr, box);
  await recordAccepted(q, { ws, dispatchId: d!, enrollmentId: enr, leadId: lead, campaignId: campaign, accountId: box, messageId: "out-1", threadId: "18c0ffee", from: "sam@agency.example", to: "info@clinic.example", subject: "Hi", body: "Body" });
  thread = (await one<{ id: string }>("select id from public.threads where provider_thread_id = '18c0ffee'", [])).id;
}, 60_000);

describe("reply sync storage", () => {
  it("finds threads the mailbox started", async () => {
    expect((await threadsForMailbox(q, box)).map((t) => t.provider_thread_id)).toEqual(["18c0ffee"]);
  });

  it("records a reply once, marks the enrollment replied and the thread unread", async () => {
    const base = { ws, threadId: thread, from: "Dr Lee <info@clinic.example>", to: "sam@agency.example", subject: "Re: Hi", classificationSource: "suggested", leadId: lead, campaignId: campaign };
    expect(await recordInbound(q, { ...base, messageId: "in-1", text: "Sounds good, call me.", at: new Date(), kind: "interested" })).toBe(true);
    expect(await recordInbound(q, { ...base, messageId: "in-1", text: "dup", at: new Date(), kind: "interested" })).toBe(false);
    const t = (await db.query<{ classification: string; unread: boolean }>("select classification, unread from public.threads where id = $1", [thread])).rows[0];
    expect(t).toEqual({ classification: "interested", unread: true });
    expect((await db.query<{ state: string }>("select state from public.enrollments where campaign_id = $1", [campaign])).rows[0].state).toBe("replied");
    // A later out-of-office doesn't overwrite a real answer.
    await recordInbound(q, { ...base, messageId: "in-2", text: "Out of office", at: new Date(), kind: "out_of_office" });
    expect((await db.query<{ classification: string }>("select classification from public.threads where id = $1", [thread])).rows[0].classification).toBe("interested");
  });

  it("keeps a person's own label", async () => {
    await as(db, A, () => setThreadState(q, thread, { classification: "not_interested" }));
    await recordInbound(q, { ws, threadId: thread, from: "x", to: "y", subject: "Re", classificationSource: "user", leadId: lead, campaignId: campaign, messageId: "in-3", text: "Yes interested", at: new Date(), kind: "interested" });
    expect((await db.query<{ classification: string; classification_source: string }>("select classification, classification_source from public.threads where id = $1", [thread])).rows[0]).toEqual({ classification: "not_interested", classification_source: "user" });
  });

  it("shows replies only to the workspace", async () => {
    expect((await as(db, A, () => inboxThreads(q, ws, "all"))).map((t) => t.id)).toEqual([thread]);
    expect(await as(db, B, () => inboxThreads(q, ws, "all"))).toEqual([]);
  });
});
