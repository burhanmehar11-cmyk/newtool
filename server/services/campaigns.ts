import "server-only";
import { accessProblem } from "@/server/services/billing";
import { z } from "zod";
import { followUpProblem, MAX_FOLLOW_UPS, type FollowUp } from "@/lib/campaigns/followups";
import { DEFAULT_SCHEDULE, isValidTimezone, type Schedule } from "@/lib/campaigns/schedule";
import { generateDraft } from "@/lib/drafts/template";
import { requireWorkspace, type WorkspaceRef } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withUser } from "@/server/db";
import {
  addSuppression,
  approveCampaign,
  campaignRecipients,
  classifyRecipient,
  createCampaign,
  eligibleLeads,
  getCampaign,
  listCampaigns,
  listFollowUps,
  updateLiveSettings,
  reopenAsDraft,
  deleteCampaign,
  saveFollowUps,
  listSuppressions,
  removeRecipient,
  removeSuppression,
  saveDraft,
  setCampaignStatus,
  updateCampaignSettings,
  bumpRevision,
} from "@/server/campaign-store";
import { listMailboxes } from "@/server/mailbox-store";
import { leadDetail, toBusiness } from "@/server/research-store";
import { runDispatch } from "@/server/services/dispatch";
import { getOfferProfile } from "@/server/services/workspaces";
import { aiWriterStatus } from "@/server/services/ai-writer";
import { syncWorkspaceReplies } from "@/server/services/replies";
import { researchLeadAs } from "@/server/services/research";
import { deliverDueWebhooks } from "@/server/services/webhooks";

const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));
const uuid = z.string().uuid();
type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const canManage = (role: string) => ["owner", "admin"].includes(role);

export async function getCampaignsOverview() {
  const { user, workspace } = await requireWorkspace("/app/campaigns");
  return asQ(user.id, async (q) => ({ campaigns: await listCampaigns(q, workspace.id), suppressions: await listSuppressions(q, workspace.id) }));
}

export async function getNewCampaignData() {
  const { user, workspace } = await requireWorkspace("/app/campaigns/new");
  const [offer, data] = await Promise.all([
    getOfferProfile(workspace),
    asQ(user.id, async (q) => ({ leads: await eligibleLeads(q, workspace.id), mailboxes: (await listMailboxes(q, workspace.id)).filter((m) => m.status === "connected") })),
  ]);
  return { ...data, hasOffer: !!offer };
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Give the campaign a name.").max(120),
  mailboxId: z.string().uuid("Choose a mailbox."),
  leadIds: z.array(z.string().uuid()).min(1, "Pick at least one lead.").max(100, "At most 100 leads per campaign."),
});

/** Creates a draft campaign and writes a first message for each lead from its Opportunity Brief. Nothing is sent. */
export async function createCampaignWithDrafts(input: unknown): Promise<R<{ id: string }>> {
  const { user, workspace } = await requireWorkspace("/app/campaigns/new");
  if (!canManage(workspace.role)) return { ok: false, error: "Only workspace owners and admins can create campaigns." };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const offer = await getOfferProfile(workspace);
  if (!offer) return { ok: false, error: "Add your offer profile in Settings first. Messages are written from it." };
  // Leads that haven't been researched yet get their website read now, so each one has facts to write from.
  await researchMissing({ user, workspace }, parsed.data.leadIds);

  const id = await asQ(user.id, async (q) => {
    const id = await createCampaign(q, workspace.id, user.id, { name: parsed.data.name, schedule: DEFAULT_SCHEDULE, mailboxId: parsed.data.mailboxId, leadIds: parsed.data.leadIds });
    for (const leadId of parsed.data.leadIds) {
      const d = await leadDetail(q, leadId);
      if (!d?.brief) continue;
      const draft = generateDraft(toBusiness(d), d.brief, offer, 0);
      await saveDraft(q, workspace.id, user.id, leadId, { ...draft, origin: "generated" });
    }
    return id;
  });
  return { ok: true, id };
}

/** Researches leads without a brief, a few at a time, within a time budget. Returns how many were researched and how many are left. */
async function researchMissing(ctx: { user: { id: string }; workspace: WorkspaceRef }, leadIds: string[], budgetMs = 35_000) {
  const todo = await asQ(ctx.user.id, (q) =>
    q.query<{ id: string }>(
      `select l.id from public.leads l join public.businesses b on b.id = l.business_id
       where l.id = any($1::uuid[]) and b.website is not null and not exists (select 1 from public.briefs br where br.business_id = l.business_id)`,
      [leadIds],
    ),
  );
  const deadline = Date.now() + budgetMs;
  const queue = todo.rows.map((r) => r.id);
  let researched = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, queue.length) }, async () => {
      while (queue.length && Date.now() < deadline) {
        const id = queue.shift()!;
        const r = await researchLeadAs(ctx, id).catch(() => null);
        if (r?.ok) researched++;
      }
    }),
  );
  return { researched, pending: queue.length };
}

/**
 * One click from search results: researches the chosen leads that haven't been
 * researched yet (within a time budget, so the request stays short), then
 * creates a draft campaign on the first connected mailbox. Nothing is sent
 * until someone reviews and approves it.
 */
export async function startCampaignFromLeads(input: unknown): Promise<R<{ id: string; researched: number; pending: number }>> {
  const ctx = await requireWorkspace("/app/discover");
  const { user, workspace } = ctx;
  if (!canManage(workspace.role)) return { ok: false, error: "Only workspace owners and admins can create campaigns." };
  const p = z.object({ name: z.string().trim().min(2).max(120), leadIds: z.array(uuid).min(1, "Select at least one business.").max(100, "At most 100 leads per campaign.") }).safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const mailbox = (await asQ(user.id, (q) => listMailboxes(q, workspace.id))).find((m) => m.status === "connected");
  if (!mailbox) return { ok: false, error: "Connect a Gmail mailbox in Mailboxes first; campaigns send from it." };
  if (!(await getOfferProfile(workspace))) return { ok: false, error: "Add your offer profile in Settings first. Emails are written from it." };

  const { researched, pending } = await researchMissing(ctx, p.data.leadIds);
  const created = await createCampaignWithDrafts({ name: p.data.name, mailboxId: mailbox.id, leadIds: p.data.leadIds });
  if (!created.ok) return created;
  return { ok: true, id: created.id, researched, pending };
}

export async function getCampaignDetail(id: string) {
  const { user, workspace } = await requireWorkspace(`/app/campaigns/${id}`);
  if (!uuid.safeParse(id).success) return null;
  return asQ(user.id, async (q) => {
    const campaign = await getCampaign(q, id);
    if (!campaign) return null;
    // One connection per request: run queries one after another.
    const recipients = await campaignRecipients(q, id);
    const mailboxes = await listMailboxes(q, workspace.id);
    const followUps = await listFollowUps(q, id);
    return {
      campaign,
      mailboxes,
      followUps,
      recipients: recipients.map((r) => ({ ...r, decision: classifyRecipient(r, campaign.policy) })),
      canManage: canManage(workspace.role),
      aiConfigured: aiWriterStatus().configured,
    };
  });
}

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  mailboxId: z.string().uuid().nullable(),
  timezone: z.string().refine(isValidTimezone, "Unknown time zone."),
  days: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day."),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
  includeUnknown: z.boolean(),
  includeCatchAll: z.boolean(),
});

export async function saveCampaignSettings(id: string, input: unknown): Promise<R> {
  const { user, workspace } = await requireWorkspace(`/app/campaigns/${id}`);
  if (!canManage(workspace.role)) return { ok: false, error: "Only workspace owners and admins can change campaigns." };
  const p = settingsSchema.safeParse(input);
  if (!uuid.safeParse(id).success || !p.success) return { ok: false, error: p.success ? "Campaign not found." : p.error.issues[0].message };
  if (p.data.endHour <= p.data.startHour) return { ok: false, error: "The end hour must be after the start hour." };
  const schedule: Schedule = { timezone: p.data.timezone, days: [...new Set(p.data.days)].sort(), startHour: p.data.startHour, endHour: p.data.endHour };
  const ok = await asQ(user.id, (q) =>
    updateCampaignSettings(q, id, { name: p.data.name, mailboxId: p.data.mailboxId, schedule, policy: { includeUnknown: p.data.includeUnknown, includeCatchAll: p.data.includeCatchAll } }),
  );
  return ok ? { ok: true } : { ok: false, error: "Only draft campaigns can be changed. Cancel it and create a new one." };
}

const followUpsSchema = z.array(z.object({ delayDays: z.number().int(), body: z.string().max(2000) })).max(MAX_FOLLOW_UPS);

/** Replaces a draft campaign's follow-ups (none, one or two). The campaign must be approved again. */
export async function saveCampaignFollowUps(id: string, input: unknown): Promise<R> {
  const { user, workspace } = await requireWorkspace(`/app/campaigns/${id}`);
  if (!canManage(workspace.role)) return { ok: false, error: "Only workspace owners and admins can change campaigns." };
  const p = followUpsSchema.safeParse(input);
  if (!uuid.safeParse(id).success || !p.success) return { ok: false, error: "Check the follow-ups and try again." };
  const steps: FollowUp[] = p.data.map((f) => ({ delayDays: f.delayDays, body: f.body.trim() }));
  const problem = followUpProblem(steps);
  if (problem) return { ok: false, error: problem };
  const ok = await asQ(user.id, (q) => saveFollowUps(q, workspace.id, id, steps));
  return ok ? { ok: true } : { ok: false, error: "Only draft campaigns can be changed. Cancel it and create a new one." };
}

const draftSchema = z.object({
  subject: z.string().trim().min(1, "Add a subject.").max(140, "Keep the subject under 140 characters."),
  body: z.string().trim().min(20, "The message is too short.").max(8000),
});

/** Saves an edited message as a new draft version. The campaign revision moves on, so it must be approved again. */
export async function editRecipientDraft(campaignId: string, leadId: string, input: unknown): Promise<R> {
  const { user, workspace } = await requireWorkspace(`/app/campaigns/${campaignId}`);
  if (!canManage(workspace.role)) return { ok: false, error: "Only workspace owners and admins can edit messages." };
  const p = draftSchema.safeParse(input);
  if (!uuid.safeParse(campaignId).success || !uuid.safeParse(leadId).success || !p.success) return { ok: false, error: p.success ? "Not found." : p.error.issues[0].message };
  return asQ(user.id, async (q) => {
    const c = await getCampaign(q, campaignId);
    if (!c || c.status !== "draft") return { ok: false as const, error: "Messages can only be edited before launch." };
    const inCampaign = (await campaignRecipients(q, campaignId)).find((r) => r.lead_id === leadId);
    if (!inCampaign) return { ok: false as const, error: "That lead isn't in this campaign." };
    await saveDraft(q, workspace.id, user.id, leadId, { subject: p.data.subject, body: p.data.body, factIds: [], origin: "edited" });
    await bumpRevision(q, campaignId);
    return { ok: true as const };
  });
}

export async function dropRecipient(campaignId: string, leadId: string): Promise<R> {
  const { user, workspace } = await requireWorkspace(`/app/campaigns/${campaignId}`);
  if (!canManage(workspace.role) || !uuid.safeParse(campaignId).success || !uuid.safeParse(leadId).success) return { ok: false, error: "Not allowed." };
  const ok = await asQ(user.id, (q) => removeRecipient(q, campaignId, leadId));
  return ok ? { ok: true } : { ok: false, error: "Recipients can only be removed before launch." };
}

const approveErrors: Record<string, string> = {
  stale: "The campaign changed since this page loaded. Review it again, then approve.",
  not_draft: "This campaign was already launched or cancelled.",
  no_mailbox: "Choose a mailbox first.",
  mailbox_not_connected: "The chosen mailbox needs reconnecting (Mailboxes page).",
  no_recipients: "No recipient can be sent to under the current settings.",
  not_found: "Campaign not found.",
};

/** Approves exactly the revision the user reviewed, then sends the first due email right away (if inside sending hours). */
export async function approveAndLaunch(campaignId: string, revision: number, confirmed: boolean): Promise<R<{ enrolled: number; sentNow: number }>> {
  const { user, workspace } = await requireWorkspace(`/app/campaigns/${campaignId}`);
  if (!canManage(workspace.role)) return { ok: false, error: "Only workspace owners and admins can approve campaigns." };
  if (!confirmed) return { ok: false, error: "Tick the box to confirm you reviewed every recipient and message." };
  {
    const why = await accessProblem(workspace.id);
    if (why) return { ok: false, error: why };
  }
  if (!uuid.safeParse(campaignId).success || !Number.isInteger(revision)) return { ok: false, error: "Campaign not found." };
  try {
    const { enrolled } = await asQ(user.id, (q) => approveCampaign(q, workspace.id, user.id, campaignId, revision));
    const r = await runDispatch({ workspaceId: workspace.id });
    return { ok: true, enrolled, sentNow: r.sent };
  } catch (e) {
    return { ok: false, error: approveErrors[(e as Error).message] ?? "Couldn't approve the campaign. Try again." };
  }
}

export async function changeCampaignStatus(campaignId: string, action: "pause" | "resume" | "cancel"): Promise<R> {
  const { user, workspace } = await requireWorkspace(`/app/campaigns/${campaignId}`);
  if (!canManage(workspace.role) || !uuid.safeParse(campaignId).success) return { ok: false, error: "Not allowed." };
  const ok = await asQ(user.id, (q) =>
    action === "pause"
      ? setCampaignStatus(q, campaignId, ["running"], "paused")
      : action === "resume"
        ? setCampaignStatus(q, campaignId, ["paused"], "running")
        : setCampaignStatus(q, campaignId, ["draft", "running", "paused"], "cancelled"),
  );
  return ok ? { ok: true } : { ok: false, error: "That change isn't possible in the campaign's current state." };
}

const liveSchema = z.object({
  name: z.string().trim().min(2, "Give the campaign a name.").max(120),
  timezone: z.string().refine(isValidTimezone, "Unknown time zone."),
  days: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day."),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
});

/** Renames a running or paused campaign, or changes its sending days and hours. */
export async function editLiveCampaign(campaignId: string, input: unknown): Promise<R> {
  const { user, workspace } = await requireWorkspace(`/app/campaigns/${campaignId}`);
  if (!canManage(workspace.role) || !uuid.safeParse(campaignId).success) return { ok: false, error: "Only workspace owners and admins can change campaigns." };
  const p = liveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  if (p.data.endHour <= p.data.startHour) return { ok: false, error: "The end hour must be after the start hour." };
  const schedule: Schedule = { timezone: p.data.timezone, days: [...new Set(p.data.days)].sort(), startHour: p.data.startHour, endHour: p.data.endHour };
  const ok = await asQ(user.id, (q) => updateLiveSettings(q, campaignId, { name: p.data.name, schedule }));
  return ok ? { ok: true } : { ok: false, error: "Only running or paused campaigns can be changed this way." };
}

/** Back to draft (paused campaigns only) so messages and recipients can be edited; needs a new approval. */
export async function reopenCampaign(campaignId: string): Promise<R> {
  const { user, workspace } = await requireWorkspace(`/app/campaigns/${campaignId}`);
  if (!canManage(workspace.role) || !uuid.safeParse(campaignId).success) return { ok: false, error: "Only workspace owners and admins can change campaigns." };
  const ok = await asQ(user.id, (q) => reopenAsDraft(q, campaignId));
  return ok ? { ok: true } : { ok: false, error: "Pause the campaign first, then edit its messages." };
}

export async function removeCampaign(campaignId: string): Promise<R> {
  const { user, workspace } = await requireWorkspace("/app/campaigns");
  if (!canManage(workspace.role) || !uuid.safeParse(campaignId).success) return { ok: false, error: "Only workspace owners and admins can delete campaigns." };
  const ok = await asQ(user.id, (q) => deleteCampaign(q, campaignId));
  return ok ? { ok: true } : { ok: false, error: "Campaign not found." };
}

/** Runs one sending pass for this workspace now (same rules as the scheduler). */
export async function sendDueNow(): Promise<R<{ sent: number; note: string | null }>> {
  const { workspace } = await requireWorkspace("/app/campaigns");
  if (!canManage(workspace.role)) return { ok: false, error: "Not allowed." };
  const r = await runDispatch({ workspaceId: workspace.id });
  const note = r.sent ? null : r.skipped[0]?.split(": ").slice(1).join(": ") || (r.failed ? "The email couldn't be sent; see the recipient's status." : "Nothing is due right now.");
  return { ok: true, sent: r.sent, note };
}

const suppressionSchema = z.object({ value: z.string().trim().toLowerCase().min(3).max(254) });

export async function addDoNotContact(input: unknown): Promise<R> {
  const { user, workspace } = await requireWorkspace("/app/campaigns");
  const p = suppressionSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Enter an email address or a domain." };
  const v = p.data.value.replace(/^@/, "");
  const kind = v.includes("@") ? "email" : "domain";
  if (kind === "email" ? !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(v) : !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return { ok: false, error: "That doesn't look like an email address or domain." };
  await asQ(user.id, (q) => addSuppression(q, workspace.id, user.id, v, kind, "manual"));
  return { ok: true };
}

export async function removeDoNotContact(id: string): Promise<R> {
  const { user, workspace } = await requireWorkspace("/app/campaigns");
  if (!canManage(workspace.role) || !uuid.safeParse(id).success) return { ok: false, error: "Not allowed." };
  const ok = await asQ(user.id, (q) => removeSuppression(q, id));
  return ok ? { ok: true } : { ok: false, error: "Unsubscribes can't be removed; only manual entries can." };
}

/**
 * "Auto-send while open": an open app tab calls this about once a minute.
 * Runs one sending pass for this workspace (same limits as the scheduler)
 * only when a campaign is running. Cheap no-op otherwise.
 */
export async function autoSendTick(): Promise<{ sent: number; newReplies: number }> {
  const { user, workspace } = await requireWorkspace("/app");
  if (!canManage(workspace.role)) return { sent: 0, newReplies: 0 };
  const replies = await syncWorkspaceReplies(workspace.id).catch(() => ({ newReplies: 0 }));
  const running = await asQ(user.id, (q) => q.query("select 1 from public.campaigns where workspace_id = $1 and status = 'running' limit 1", [workspace.id]));
  const r = running.rows.length ? await runDispatch({ workspaceId: workspace.id }) : { sent: 0 };
  await deliverDueWebhooks({ workspaceId: workspace.id, limit: 10 });
  return { sent: r.sent, newReplies: replies.newReplies };
}
