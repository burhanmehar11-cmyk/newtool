"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/server/auth";
import { disconnectApp } from "@/server/services/oauth";

export async function disconnectAppAction(grantId: string) {
  const { user, workspace } = await requireWorkspace("/app/agent");
  const ok = await disconnectApp(user.id, workspace.id, grantId);
  if (ok) revalidatePath("/app/agent");
  return ok ? { ok: true as const } : { ok: false as const, error: "That connection wasn't found." };
}
