import type { Q } from "@/server/auth-store";

/**
 * Team members and invitations. Role checks live in the database functions
 * (migration 0009); these helpers only call them.
 */

export type MemberRow = { user_id: string; email: string; full_name: string | null; role: string; joined_at: string };
export type InviteRow = { id: string; email: string; role: "admin" | "member"; created_at: string; expires_at: string };
export type InvitePreview = { workspaceName: string; email: string; role: string; status: "pending" | "expired" | "used" | "revoked" };

export async function listMembers(q: Q, ws: string): Promise<MemberRow[]> {
  return (await q.query<MemberRow>("select * from app.workspace_members($1)", [ws])).rows;
}

export async function listInvites(q: Q, ws: string): Promise<InviteRow[]> {
  return (
    await q.query<InviteRow>(
      "select id, email, role, created_at, expires_at from public.workspace_invites where workspace_id = $1 and accepted_at is null and revoked_at is null and expires_at > now() order by created_at desc",
      [ws],
    )
  ).rows;
}

export async function createInvite(q: Q, ws: string, email: string, role: string, tokenHash: string): Promise<string> {
  return (await q.query<{ id: string }>("select app.invite_member($1, $2, $3, $4) as id", [ws, email, role, tokenHash])).rows[0].id;
}

export async function revokeInvite(q: Q, id: string): Promise<boolean> {
  return (await q.query<{ ok: boolean }>("select app.revoke_invite($1) as ok", [id])).rows[0].ok;
}

export async function acceptInvite(q: Q, tokenHash: string): Promise<string> {
  return (await q.query<{ ws: string }>("select app.accept_invite($1) as ws", [tokenHash])).rows[0].ws;
}

export type MyInvite = { id: string; workspace_name: string; role: string; expires_at: string };

export async function myInvites(q: Q): Promise<MyInvite[]> {
  return (await q.query<MyInvite>("select * from app.my_invites()")).rows;
}

export async function acceptInviteById(q: Q, id: string): Promise<string> {
  return (await q.query<{ ws: string }>("select app.accept_invite_id($1) as ws", [id])).rows[0].ws;
}

export async function setMemberRole(q: Q, ws: string, userId: string, role: string): Promise<boolean> {
  return (await q.query<{ ok: boolean }>("select app.set_member_role($1, $2, $3) as ok", [ws, userId, role])).rows[0].ok;
}

export async function removeMember(q: Q, ws: string, userId: string): Promise<boolean> {
  return (await q.query<{ ok: boolean }>("select app.remove_member($1, $2) as ok", [ws, userId])).rows[0].ok;
}

/** Service connection: what an invite link points to (shown before sign-in). */
export async function previewInvite(q: Q, tokenHash: string): Promise<InvitePreview | null> {
  const r = await q.query<{ name: string; email: string; role: string; expires_at: string; accepted_at: string | null; revoked_at: string | null }>(
    `select w.name, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at
     from public.workspace_invites i join public.workspaces w on w.id = i.workspace_id where i.token_hash = $1`,
    [tokenHash],
  );
  const i = r.rows[0];
  if (!i) return null;
  const status = i.revoked_at ? "revoked" : i.accepted_at ? "used" : new Date(i.expires_at) <= new Date() ? "expired" : "pending";
  return { workspaceName: i.name, email: i.email, role: i.role, status };
}

/**
 * Service connection: may this email sign in although it isn't on the
 * allowlist? Yes with a pending invite, or as a member someone invited
 * (not as the owner of a workspace they created).
 */
export async function hasTeamAccess(q: Q, email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const r = await q.query(
    `select 1 from public.workspace_invites i where i.email = $1 and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
     union all
     select 1 from public.memberships m join auth.users u on u.id = m.user_id where lower(u.email) = $1 and m.role <> 'owner'
     limit 1`,
    [e],
  );
  return r.rows.length > 0;
}
