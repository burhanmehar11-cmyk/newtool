"use server";

import { revalidatePath } from "next/cache";
import { exportLeadsCsv, importLeadsCsv, leadIdsForPlaces } from "@/server/services/leads-io";
import { startCampaignFromLeads } from "@/server/services/campaigns";

export async function exportLeadsAction(leadIds?: string[]) {
  return exportLeadsCsv({ leadIds });
}

/** Saved search results (by Google place id) as CSV. */
export async function exportPlacesAction(placeIds: string[]) {
  const ids = await leadIdsForPlaces(placeIds);
  if (!ids.length) return { ok: false as const, error: "Save the businesses first." };
  return exportLeadsCsv({ leadIds: ids });
}

export async function importLeadsAction(text: string) {
  const r = await importLeadsCsv(text);
  if (r.ok) revalidatePath("/app/leads");
  return r;
}

export async function startCampaignFromPlacesAction(input: { name: string; placeIds: string[] }) {
  const leadIds = await leadIdsForPlaces(input.placeIds ?? []);
  if (!leadIds.length) return { ok: false as const, error: "Save the businesses first." };
  const r = await startCampaignFromLeads({ name: input.name, leadIds });
  if (r.ok) revalidatePath("/app/campaigns");
  return r;
}
