"use server";

import { revalidatePath } from "next/cache";
import { createMyToken, revokeMyToken } from "@/server/services/tokens";

export async function createTokenAction(name: string) {
  const r = await createMyToken(name);
  revalidatePath("/app/agent");
  return r;
}

export async function revokeTokenAction(id: string) {
  const ok = await revokeMyToken(id);
  revalidatePath("/app/agent");
  return ok;
}
