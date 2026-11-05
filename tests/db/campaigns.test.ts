import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { DEFAULT_SCHEDULE } from "@/lib/campaigns/schedule";
import { addSuppression, approveCampaign, campaignRecipients, createCampaign, eligibleLeads, getCampaign, saveDraft, setCampaignStatus, updateCampaignSettings } from "@/server/campaign-store";
import { claimDispatch, completeFinished, mailboxUsage, nextDue, recordAccepted, runningCampaigns } from "@/server/dispatch-store";
import { upsertMailbox } from "@/server/mailbox-store";
import { as, createTestDb, createUser } from "./harness";

const A = "00000000-0000-4000-8000-0000000000a4";
const B = "00000000-0000-4000-8000-0000000000b4";
let db: PGlite;
let q: Q;
let ws: string;
let mailbox: string;
const leads: string[] = [];

async function seedLead(n: number, opts: { brief?: boolean; email?: string | null } = {}) {
  return as(db, A, async () => {
    const b = (await db.query<{ id: string }>("insert into public.businesses (workspace_id, provider, provider_ref, name, collected_at) values ($1, 'openstreetmap', $2, $3, now()) returning id", [ws, `osm:${n}`, `Clinic ${n}`])).rows[0].id;
    if (opts.email !== null) await db.query("insert into public.contacts (workspace_id, business_id, email_normalized) values ($1, $2, $3)", [ws, b, opts.email ?? `info@clinic${n}.example`]);
    if (opts.brief !== false) await db.query("insert into public.briefs (workspace_id, business_id, offer_type, payload, generator) values ($1, $2, 'web_design', '{}'::jsonb, 'template')", [ws, b]);
    return (await db.query<{ id: string }>("insert into public.leads (workspace_id, business_id, source) values ($1, $2, 'search') returning id", [ws, b])).rows[0].id;
  });
}

beforeAll(async () => {
  db = await createTestDb();
  q = db as unknown as Q;
  await createUser(db, A, "a@agency.example");
  await createUser(db, B, "b@agency.example");
  ws = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency A') as id")).rows[0].id);
  await as(db, B, () => db.query("select public.create_workspace('Agency B')"));
  mailbox = await as(db, A, () => upsertMailbox(q, ws, A, "sam@agency.example", "Sam", "gmail.send"));
  leads.push(await seedLead(1), await seedLead(2), await seedLead(3, { brief: false }), await seedLead(4, { email: null }));
}, 60_000);

describe("campaigns", () => {
  let campaign: string;

  it("lists only researched leads with an email as eligible", async () => {
    const eligible = await as(db, A, () => eligibleLeads(q, ws));
    expect(eligible.map((l) => l.lead_id).sort()).toEqual([leads[0], leads[1]].sort());
  });

  it("creates a draft campaign and refuses a stale approval", async () => {
    campaign = await as(db, A, async () => {
      const id = await createCampaign(q, ws, A, { name: "Austin", schedule: DEFAULT_SCHEDULE, mailboxId: mailbox, leadIds: [leads[0], leads[1], leads[3]] });
      await saveDraft(q, ws, A, leads[0], { subject: "Hello 1", body: "Body one, long enough.", factIds: [], origin: "generated" });
      await saveDraft(q, ws, A, leads[1], { subject: "Hello 2", body: "Body two, long enough.", factIds: [], origin: "generated" });
      return id;
    });
    const c = await as(db, A, () => getCampaign(q, campaign));
    // Unverified addresses aren't included by default.
    await expect(as(db, A, () => approveCampaign(q, ws, A, campaign, c!.revision))).rejects.toThrow("no_recipients");
    await as(db, A, () => updateCampaignSettings(q, campaign, { name: "Austin", mailboxId: mailbox, schedule: DEFAULT_SCHEDULE, policy: { includeUnknown: true, includeCatchAll: false } }));
    await expect(as(db, A, () => approveCampaign(q, ws, A, campaign, c!.revision))).rejects.toThrow("stale");
  });

  it("approves exactly the reviewed revision and enrolls who will be sent to", async () => {
    const c = await as(db, A, () => getCampaign(q, campaign));
    expect(await as(db, A, () => approveCampaign(q, ws, A, campaign, c!.revision))).toEqual({ enrolled: 2 });
    const after = await as(db, A, () => getCampaign(q, campaign));
    expect(after?.status).toBe("running");
    const approval = (await db.query<{ revision: number; recipient_lead_ids: string[]; draft_versions: Record<string, number> }>("select revision, recipient_lead_ids, draft_versions from public.approvals where campaign_id = $1", [campaign])).rows[0];
    expect(approval.revision).toBe(c!.revision);
    expect(approval.recipient_lead_ids.sort()).toEqual([leads[0], leads[1]].sort());
    expect(approval.draft_versions).toEqual({ [leads[0]]: 1, [leads[1]]: 1 });
    // A later draft edit doesn't change what was approved.
    await as(db, A, () => saveDraft(q, ws, A, leads[0], { subject: "Changed", body: "Changed body text here.", factIds: [], origin: "edited" }));
    const rows = await as(db, A, () => campaignRecipients(q, campaign));
    expect(rows.find((r) => r.lead_id === leads[0])?.subject).toBe("Hello 1");
  });

  it("won't put the same address in two active campaigns", async () => {
    const second = await as(db, A, async () => {
      const id = await createCampaign(q, ws, A, { name: "Again", schedule: DEFAULT_SCHEDULE, mailboxId: mailbox, leadIds: [leads[0]] });
      await updateCampaignSettings(q, id, { name: "Again", mailboxId: mailbox, schedule: DEFAULT_SCHEDULE, policy: { includeUnknown: true, includeCatchAll: false } });
      return id;
    });
    const c = await as(db, A, () => getCampaign(q, second));
    await expect(as(db, A, () => approveCampaign(q, ws, A, second, c!.revision))).rejects.toThrow("no_recipients");
  });

  it("is invisible and unapprovable from another workspace", async () => {
    expect(await as(db, B, () => getCampaign(q, campaign))).toBeNull();
    expect(await as(db, B, () => setCampaignStatus(q, campaign, ["running"], "cancelled"))).toBe(false);
  });

  it("sends each email at most once and completes when done (service connection)", async () => {
    const running = await runningCampaigns(q, ws);
    expect(running.map((r) => r.id)).toContain(campaign);
    const due = await nextDue(q, campaign);
    expect(due?.subject).toMatch(/^Hello [12]$/); // the approved version, never the later edit
    const d1 = await claimDispatch(q, ws, campaign, due!.id, mailbox);
    expect(d1).toBeTruthy();
    expect(await claimDispatch(q, ws, campaign, due!.id, mailbox)).toBeNull(); // a second pass can't take it
    await recordAccepted(q, { ws, dispatchId: d1!, enrollmentId: due!.id, leadId: due!.lead_id, campaignId: campaign, messageId: "gm-1", threadId: "th-1", from: "sam@agency.example", to: due!.email, subject: due!.subject, body: due!.body });
    expect((await mailboxUsage(q, mailbox, "UTC")).today).toBe(1);
    const next = await nextDue(q, campaign);
    expect(next?.id).not.toBe(due!.id);

    // Unsubscribing stops the remaining queued email.
    await as(db, A, () => addSuppression(q, ws, A, next!.email, "email", "manual"));
    expect(await nextDue(q, campaign)).toBeNull();
    await completeFinished(q, campaign);
    expect((await as(db, A, () => getCampaign(q, campaign)))?.status).toBe("completed");
    const msg = (await db.query("select direction, to_addr from public.messages where provider_message_id = 'gm-1'")).rows;
    expect(msg).toEqual([{ direction: "outbound", to_addr: due!.email }]);
  });
});
