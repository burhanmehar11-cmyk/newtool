import "server-only";
import { z } from "zod";
import { DEFAULT_SCHEDULE, isValidTimezone, type Schedule } from "@/lib/campaigns/schedule";
import { generateDraft } from "@/lib/drafts/template";
import { requireWorkspace } from "@/server/auth";
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

export async function getCampaignDetail(id: string) {
  const { user, workspace } = await requireWorkspace(`/app/campaigns/${id}`);
  if (!uuid.safeParse(id).success) return null;
  return asQ(user.id, async (q) => {
    const campaign = await getCampaign(q, id);
    if (!campaign) return null;
    const [recipients, mailboxes] = await Promise.all([campaignRecipients(q, id), listMailboxes(q, workspace.id)]);
    return {
      campaign,
      mailboxes,
      recipients: recipients.map((r) => ({ ...r, decision: classifyRecipient(r, campaign.policy) })),
      canManage: canManage(workspace.role),
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
