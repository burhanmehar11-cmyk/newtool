"use server";

import { revalidatePath } from "next/cache";
import {
  addDoNotContact,
  approveAndLaunch,
  changeCampaignStatus,
  createCampaignWithDrafts,
  dropRecipient,
  editRecipientDraft,
  removeDoNotContact,
  saveCampaignFollowUps, saveCampaignSettings,
  sendDueNow,
  autoSendTick,
} from "@/server/services/campaigns";

const refresh = () => revalidatePath("/app", "layout");

export async function createCampaignAction(input: { name: string; mailboxId: string; leadIds: string[] }) {
  const r = await createCampaignWithDrafts(input);
  if (r.ok) refresh();
  return r;
}
export async function saveCampaignSettingsAction(id: string, input: unknown) {
  const r = await saveCampaignSettings(id, input);
  refresh();
  return r;
}
export async function saveFollowUpsAction(id: string, steps: { delayDays: number; body: string }[]) {
  const r = await saveCampaignFollowUps(id, steps);
  refresh();
  return r;
}
export async function editDraftAction(campaignId: string, leadId: string, input: { subject: string; body: string }) {
  const r = await editRecipientDraft(campaignId, leadId, input);
  refresh();
  return r;
}
export async function dropRecipientAction(campaignId: string, leadId: string) {
  const r = await dropRecipient(campaignId, leadId);
  refresh();
  return r;
}
export async function approveAction(campaignId: string, revision: number, confirmed: boolean) {
  const r = await approveAndLaunch(campaignId, revision, confirmed);
  refresh();
  return r;
}
export async function campaignStatusAction(campaignId: string, action: "pause" | "resume" | "cancel") {
  const r = await changeCampaignStatus(campaignId, action);
  refresh();
  return r;
}
export async function sendDueNowAction() {
  const r = await sendDueNow();
  refresh();
  return r;
}
export async function addDoNotContactAction(value: string) {
  const r = await addDoNotContact({ value });
  refresh();
  return r;
}
export async function removeDoNotContactAction(id: string) {
  const r = await removeDoNotContact(id);
  refresh();
  return r;
}

/** Called by open app tabs about once a minute; revalidates only when something was sent. */
export async function autoSendTickAction() {
  const r = await autoSendTick();
  if (r.sent || r.newReplies) refresh();
  return r;
}
