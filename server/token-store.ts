import type { Q } from "@/server/auth-store";

/** Personal access tokens for MCP agents. Only SHA-256 hashes are stored. */

export type TokenRow = { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null };

export async function insertToken(q: Q, ws: string, userId: string, name: string, hash: string, prefix: string): Promise<string> {
  const r = await q.query<{ id: string }>("insert into public.api_tokens (workspace_id, user_id, name, token_hash, prefix) values ($1, $2, $3, $4, $5) returning id", [ws, userId, name, hash, prefix]);
  return r.rows[0].id;
}

export async function listTokens(q: Q, ws: string): Promise<TokenRow[]> {
  return (await q.query<TokenRow>("select id, name, prefix, created_at, last_used_at, revoked_at from public.api_tokens where workspace_id = $1 and revoked_at is null order by created_at desc", [ws])).rows;
}

export async function revokeToken(q: Q, id: string): Promise<boolean> {
  return (await q.query("update public.api_tokens set revoked_at = now() where id = $1 and revoked_at is null returning id", [id])).rows.length > 0;
}

/** Service connection: resolve a token to its user, workspace and current role (membership must still exist). */
export async function resolveToken(q: Q, hash: string): Promise<{ tokenId: string; userId: string; workspaceId: string; workspaceName: string; role: string } | null> {
  const r = await q.query<{ id: string; user_id: string; workspace_id: string; name: string; role: string }>(
    `select t.id, t.user_id, t.workspace_id, w.name, m.role
     from public.api_tokens t
     join public.memberships m on m.workspace_id = t.workspace_id and m.user_id = t.user_id
     join public.workspaces w on w.id = t.workspace_id
     where t.token_hash = $1 and t.revoked_at is null`,
    [hash],
  );
  const t = r.rows[0];
  if (!t) return null;
  await q.query("update public.api_tokens set last_used_at = now() where id = $1 and (last_used_at is null or last_used_at < now() - interval '1 minute')", [t.id]);
  return { tokenId: t.id, userId: t.user_id, workspaceId: t.workspace_id, workspaceName: t.name, role: t.role };
}
