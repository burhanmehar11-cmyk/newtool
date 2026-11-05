"use server";

import { redirect } from "next/navigation";
import { unsubscribeByToken } from "@/server/services/unsubscribe";

export async function confirmUnsubscribeAction(form: FormData) {
  const token = String(form.get("token") ?? "");
  const ok = await unsubscribeByToken(token);
  redirect(ok ? `/unsubscribe/${token}?done=1` : `/unsubscribe/${token}`);
}
