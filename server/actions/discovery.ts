"use server";

import { revalidatePath } from "next/cache";
import { getGooglePlaceDetails, runGoogleSearch, runSearch, saveGoogleSearchLeads, saveSearchLeads, type GoogleSearchOutcome, type SearchOutcome } from "@/server/services/discovery";

export async function runSearchAction(values: unknown): Promise<SearchOutcome> {
  const r = await runSearch(values);
  revalidatePath("/app", "layout");
  return r;
}

export async function saveLeadsAction(ids: string[]) {
  const r = await saveSearchLeads(ids);
  if (r.ok) revalidatePath("/app", "layout");
  return r;
}

export async function runGoogleSearchAction(values: unknown): Promise<GoogleSearchOutcome> {
  const r = await runGoogleSearch(values);
  revalidatePath("/app", "layout");
  return r;
}

export async function saveGoogleLeadsAction(input: { niche: string | null; items: { placeId: string; website: string }[] }) {
  const r = await saveGoogleSearchLeads(input);
  if (r.ok) revalidatePath("/app", "layout");
  return r;
}

export async function googleDetailsAction(placeId: string) {
  return getGooglePlaceDetails(placeId);
}
