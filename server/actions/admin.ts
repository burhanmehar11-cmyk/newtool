"use server";

import { revalidatePath } from "next/cache";
import { setWorkspacePlan } from "@/server/services/admin";

export async function setPlanAction(input: { workspaceId: string; plan: string; trialEndsAt: string | null; note: string | null }) {
  const r = await setWorkspacePlan(input);
  if (r.ok) revalidatePath("/admin");
  return r;
}
