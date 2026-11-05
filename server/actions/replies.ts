"use server";

import { revalidatePath } from "next/cache";
import { checkRepliesNow, labelThread, markThreadRead } from "@/server/services/replies";

export async function checkRepliesAction() {
  const r = await checkRepliesNow();
  revalidatePath("/app", "layout");
  return r;
}

export async function labelThreadAction(id: string, kind: string) {
  const r = await labelThread(id, kind);
  revalidatePath("/app", "layout");
  return r;
}

export async function markThreadReadAction(id: string) {
  await markThreadRead(id);
  revalidatePath("/app/inbox");
}
