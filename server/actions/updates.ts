"use server";

import { redirect } from "next/navigation";
import { unsubscribeFromUpdates } from "@/server/services/announcements";

export async function confirmUpdatesUnsubscribeAction(form: FormData) {
  const token = String(form.get("token") ?? "");
  // Back to the page it came from (short /u/… or the older long link); nowhere else.
  const path = String(form.get("path") ?? "");
  const back = /^\/(u|updates\/unsubscribe)\/[A-Za-z0-9._-]+$/.test(path) ? path : `/updates/unsubscribe/${encodeURIComponent(token)}`;
  const ok = await unsubscribeFromUpdates(token);
  redirect(ok ? `${back}?done=1` : back);
}
