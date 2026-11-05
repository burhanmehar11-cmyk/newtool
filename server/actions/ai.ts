"use server";

import { revalidatePath } from "next/cache";
import { writeCampaignDrafts, writeDraft } from "@/server/services/ai-writer";

export async function writeDraftAction(leadId: string) {
  const r = await writeDraft(leadId);
  revalidatePath("/app", "layout");
  return r;
}

export async function writeCampaignDraftsAction(campaignId: string) {
  const r = await writeCampaignDrafts(campaignId);
  revalidatePath("/app", "layout");
  return r;
}
