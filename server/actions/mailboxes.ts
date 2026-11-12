"use server";

import { revalidatePath } from "next/cache";
import { disconnectMailbox, saveMailboxSettings, sendTestEmail } from "@/server/services/mailboxes";

export async function sendTestEmailAction(accountId: string) {
  const r = await sendTestEmail(accountId);
  revalidatePath("/app/mailboxes");
  return r;
}

export async function saveMailboxSettingsAction(accountId: string, values: { dailyCap: number; senderName: string }) {
  const r = await saveMailboxSettings(accountId, values);
  if (r.ok) revalidatePath("/app/mailboxes");
  return r;
}

export async function disconnectMailboxAction(accountId: string) {
  const r = await disconnectMailbox(accountId);
  if (r.ok) revalidatePath("/app/mailboxes");
  return r;
}

export async function testMailboxConnectionAction(input: unknown) {
  const { testMailboxConnection } = await import("@/server/services/mailboxes");
  return testMailboxConnection(input);
}

export async function addSmtpMailboxAction(input: unknown) {
  const { addSmtpMailbox } = await import("@/server/services/mailboxes");
  const r = await addSmtpMailbox(input);
  if (r.ok) revalidatePath("/app/mailboxes");
  return r;
}
