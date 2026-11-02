"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_WORKSPACE_COOKIE, listWorkspaces, requireUser } from "@/server/auth";
import { createWorkspaceWithOffer, renameWorkspace, saveOfferProfile, type ServiceResult } from "@/server/services/workspaces";

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function createWorkspaceAction(values: unknown): Promise<ServiceResult<{ workspaceId: string }>> {
  const r = await createWorkspaceWithOffer(values);
  if (r.ok) (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, r.value.workspaceId, cookieOptions);
  return r;
}

export async function saveOfferAction(values: unknown): Promise<ServiceResult> {
  const r = await saveOfferProfile(values);
  if (r.ok) revalidatePath("/app", "layout");
  return r;
}

export async function renameWorkspaceAction(name: unknown): Promise<ServiceResult> {
  const r = await renameWorkspace(name);
  if (r.ok) revalidatePath("/app", "layout");
  return r;
}

export async function switchWorkspaceAction(workspaceId: string): Promise<ServiceResult> {
  await requireUser();
  const mine = await listWorkspaces();
  if (!mine.some((w) => w.id === workspaceId)) return { ok: false, error: "You are not a member of that workspace." };
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, cookieOptions);
  revalidatePath("/app", "layout");
  return { ok: true, value: undefined };
}
