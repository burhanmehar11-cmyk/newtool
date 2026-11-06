"use server";

import { revalidatePath } from "next/cache";
import { createMyToken, myTokenStatus, revokeMyToken } from "@/server/services/tokens";

export async function createTokenAction(name: string) {
  const r = await createMyToken(name);
  revalidatePath("/app/agent");
  return r;
}

export async function tokenStatusAction(id: string) {
  return myTokenStatus(id);
}

export async function revokeTokenAction(id: string) {
  const ok = await revokeMyToken(id);
  revalidatePath("/app/agent");
  return ok;
}
