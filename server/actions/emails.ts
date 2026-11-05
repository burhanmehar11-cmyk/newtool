"use server";

import { revalidatePath } from "next/cache";
import { findEmailsForResults, findMissingLeadEmails } from "@/server/services/emails";

export async function findEmailsForResultsAction(items: { placeId: string; website: string }[]) {
  return findEmailsForResults(items);
}

export async function findMissingLeadEmailsAction() {
  const r = await findMissingLeadEmails();
  revalidatePath("/app", "layout");
  return r;
}
