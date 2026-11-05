import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { brand } from "@/config/brand";
import { requireUser, requireWorkspace } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withService, withUser } from "@/server/db";
import { emailConfigured, sendEmail } from "@/server/email";
import { configuredSiteUrl } from "@/server/env";
import { acceptInvite, acceptInviteById, createInvite, myInvites, listInvites, listMembers, previewInvite, removeMember, revokeInvite, setMemberRole, type InvitePreview } from "@/server/team-store";

const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));

export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const MESSAGES: Record<string, string> = {
  forbidden: "Only the owner or an admin can do that.",
  bad_role: "Choose Admin or Member.",
  bad_email: "Enter a valid email address.",
  already_member: "That person is already in this workspace.",
  too_many: "There are 50 open invites. Revoke some first.",
  invalid: "This invite link isn't valid any more.",
  expired: "This invite has expired. Ask for a new one.",
  wrong_email: "This invite is for a different email address.",
};
const friendly = (e: unknown) => MESSAGES[(e as Error)?.message] ?? "Something went wrong. Try again.";

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

export async function getTeam() {
  const { user, workspace } = await requireWorkspace("/app/team");
  const canManage = ["owner", "admin"].includes(workspace.role);
  // One connection per request: run queries one after another.
  const { members, invites } = await asQ(user.id, async (q) => ({ members: await listMembers(q, workspace.id), invites: canManage ? await listInvites(q, workspace.id) : [] }));
  return { me: user.id, workspace, canManage, members, invites, emailOn: emailConfigured() };
}

const inviteInput = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254), role: z.enum(["admin", "member"]) });

/** Creates an invite link (valid 7 days). Emails it when SMTP is set up; the link is always returned to copy. */
export async function inviteToTeam(input: unknown): Promise<Result<{ link: string; emailed: boolean }>> {
  const { user, workspace } = await requireWorkspace("/app/team");
  const p = inviteInput.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const token = randomBytes(32).toString("base64url");
  try {
    await asQ(user.id, (q) => createInvite(q, workspace.id, p.data.email, p.data.role, hashInviteToken(token)));
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
  const link = `${configuredSiteUrl() ?? brand.siteUrl}/invite/${token}`;
  let emailed = false;
  if (emailConfigured()) {
    try {
      await sendEmail(
        p.data.email,
        `Join ${workspace.name} on ${brand.name}`,
        `${user.email ?? "A teammate"} invited you to join "${workspace.name}" on ${brand.name} as ${p.data.role === "admin" ? "an admin" : "a member"}.\n\nAccept the invite (valid for 7 days):\n${link}\n\nSign in with this email address (${p.data.email}). If you weren't expecting this, you can ignore it.`,
      );
      emailed = true;
    } catch {
      emailed = false;
    }
  }
  return { ok: true, value: { link, emailed } };
}

export async function revokeTeamInvite(id: string): Promise<Result> {
  const { user } = await requireWorkspace("/app/team");
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invite not found." };
  return (await asQ(user.id, (q) => revokeInvite(q, id))) ? { ok: true, value: undefined } : { ok: false, error: "Invite not found." };
}

export async function changeMemberRole(userId: string, role: unknown): Promise<Result> {
  const { user, workspace } = await requireWorkspace("/app/team");
  const r = z.enum(["admin", "member"]).safeParse(role);
  if (!r.success || !z.string().uuid().safeParse(userId).success) return { ok: false, error: "Choose Admin or Member." };
  try {
    return (await asQ(user.id, (q) => setMemberRole(q, workspace.id, userId, r.data))) ? { ok: true, value: undefined } : { ok: false, error: "The owner's role can't be changed." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

/** Removes someone, or yourself (leaving). The owner can't be removed. */
export async function removeFromTeam(userId: string): Promise<Result<{ left: boolean }>> {
  const { user, workspace } = await requireWorkspace("/app/team");
  if (!z.string().uuid().safeParse(userId).success) return { ok: false, error: "Member not found." };
  try {
    const ok = await asQ(user.id, (q) => removeMember(q, workspace.id, userId));
    return ok ? { ok: true, value: { left: userId === user.id } } : { ok: false, error: "The owner can't be removed." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  if (!TOKEN_RE.test(token)) return null;
  return withService((q) => previewInvite(q as unknown as Q, hashInviteToken(token)));
}

export async function acceptTeamInvite(token: string): Promise<Result<{ workspaceId: string }>> {
  const user = await requireUser(`/invite/${token}`);
  if (!TOKEN_RE.test(token)) return { ok: false, error: MESSAGES.invalid };
  try {
    return { ok: true, value: { workspaceId: await asQ(user.id, (q) => acceptInvite(q, hashInviteToken(token))) } };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

/** Open invites for the signed-in person (onboarding offers them before creating a workspace). */
export async function getMyInvites() {
  const user = await requireUser("/app/onboarding");
  try {
    return await asQ(user.id, (q) => myInvites(q));
  } catch {
    return []; // migration 0009 not run yet
  }
}

export async function acceptMyInvite(id: string): Promise<Result<{ workspaceId: string }>> {
  const user = await requireUser("/app/onboarding");
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: MESSAGES.invalid };
  try {
    return { ok: true, value: { workspaceId: await asQ(user.id, (q) => acceptInviteById(q, id)) } };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
