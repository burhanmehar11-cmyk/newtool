"use server";

import { revalidatePath } from "next/cache";
import { checkContactEmail, researchLead, updateLeadNotes } from "@/server/services/research";

export async function researchLeadAction(leadId: string) {
  const r = await researchLead(leadId);
  revalidatePath(`/app/leads/${leadId}`);
  revalidatePath("/app/leads");
  return r;
}

export async function checkEmailAction(contactId: string, leadId: string) {
  const r = await checkContactEmail(contactId);
  revalidatePath(`/app/leads/${leadId}`);
  return r;
}

export async function saveNotesAction(leadId: string, notes: string) {
  const ok = await updateLeadNotes(leadId, notes);
  return ok ? { ok: true as const } : { ok: false as const, error: "Couldn't save notes." };
}
