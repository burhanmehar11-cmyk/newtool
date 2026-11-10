"use server";

import { redirect } from "next/navigation";
import { unsubscribeFromUpdates } from "@/server/services/announcements";

export async function confirmUpdatesUnsubscribeAction(form: FormData) {
  const token = String(form.get("token") ?? "");
  const ok = await unsubscribeFromUpdates(token);
  redirect(ok ? `/updates/unsubscribe/${token}?done=1` : `/updates/unsubscribe/${token}`);
}
