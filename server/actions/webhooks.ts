"use server";

import { revalidatePath } from "next/cache";
import { createWebhook, removeWebhook, testWebhook, toggleWebhook } from "@/server/services/webhooks";

const refresh = () => revalidatePath("/app/agent");

export async function createWebhookAction(input: { url: string; events: string[] }) {
  const r = await createWebhook(input);
  refresh();
  return r;
}
export async function removeWebhookAction(id: string) {
  const ok = await removeWebhook(id);
  refresh();
  return ok;
}
export async function toggleWebhookAction(id: string, enabled: boolean) {
  const ok = await toggleWebhook(id, enabled);
  refresh();
  return ok;
}
export async function testWebhookAction(id: string) {
  const r = await testWebhook(id);
  refresh();
  return r;
}
