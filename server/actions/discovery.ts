"use server";

import { revalidatePath } from "next/cache";
import { runSearch, saveSearchLeads, type SearchOutcome } from "@/server/services/discovery";

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
