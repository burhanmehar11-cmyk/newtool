"use server";

import { revalidatePath } from "next/cache";
import { disconnectMailbox, saveMailboxSettings, sendTestEmail } from "@/server/services/mailboxes";

export async function sendTestEmailAction(accountId: string) {
  const r = await sendTestEmail(accountId);
  revalidatePath("/app/settings");
  return r;
}

export async function saveMailboxSettingsAction(accountId: string, values: { dailyCap: number; senderName: string }) {
  const r = await saveMailboxSettings(accountId, values);
  if (r.ok) revalidatePath("/app/settings");
  return r;
}

export async function disconnectMailboxAction(accountId: string) {
  const r = await disconnectMailbox(accountId);
  if (r.ok) revalidatePath("/app/settings");
  return r;
}
