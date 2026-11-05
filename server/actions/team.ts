"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIVE_WORKSPACE_COOKIE } from "@/server/auth";
import { acceptMyInvite, acceptTeamInvite, changeMemberRole, inviteToTeam, removeFromTeam, revokeTeamInvite, type Result } from "@/server/services/team";

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

async function done<T>(r: Result<T>, path = "/app/team"): Promise<Result<T>> {
  if (r.ok) revalidatePath(path);
  return r;
}

export async function inviteAction(input: unknown) {
  return done(await inviteToTeam(input));
}

export async function revokeInviteAction(id: string) {
  return done(await revokeTeamInvite(id));
}

export async function changeRoleAction(userId: string, role: string) {
  return done(await changeMemberRole(userId, role));
}

export async function removeMemberAction(userId: string) {
  const r = await removeFromTeam(userId);
  if (r.ok && r.value.left) {
    (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
    revalidatePath("/app", "layout");
  }
  return done(r);
}

/** Joins the workspace and makes it the active one (by link token, or by invite id from onboarding). */
export async function acceptInviteAction(token: string, by: "token" | "id" = "token") {
  const r = by === "id" ? await acceptMyInvite(token) : await acceptTeamInvite(token);
  if (r.ok) {
    (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, r.value.workspaceId, cookieOptions);
    revalidatePath("/app", "layout");
    redirect("/app");
  }
  return r;
}
