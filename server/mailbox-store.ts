import type { Q } from "@/server/auth-store";

/**
 * Mailbox persistence. Account rows are read and written as the signed-in
 * user (RLS limits them to the workspace). Token rows are written and read
 * only with the service connection; signed-in users have no access at all.
 */

export type MailboxRow = {
  id: string;
  email: string;
  sender_name: string | null;
  status: "connected" | "needs_reconnect" | "revoked" | "disconnected";
  daily_cap: number;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
};

const COLS = "id, email, sender_name, status, daily_cap, last_tested_at, last_error, created_at";

export async function upsertMailbox(q: Q, ws: string, userId: string, email: string, senderName: string | null, scopes: string): Promise<string> {
  const r = await q.query<{ id: string }>(
    `insert into public.sending_accounts (workspace_id, provider, email, sender_name, scopes, status, connected_by)
     values ($1, 'gmail', $2, $3, $4, 'connected', $5)
     on conflict (workspace_id, email) do update set status = 'connected', scopes = excluded.scopes, connected_by = excluded.connected_by,
       sender_name = coalesce(public.sending_accounts.sender_name, excluded.sender_name), last_error = null
     returning id`,
    [ws, email.toLowerCase(), senderName?.slice(0, 80) || null, scopes.slice(0, 1000), userId],
  );
  return r.rows[0].id;
}

export async function listMailboxes(q: Q, ws: string): Promise<MailboxRow[]> {
  return (await q.query<MailboxRow>(`select ${COLS} from public.sending_accounts where workspace_id = $1 and status <> 'disconnected' order by created_at`, [ws])).rows;
}

export async function getMailbox(q: Q, id: string): Promise<MailboxRow | null> {
  return (await q.query<MailboxRow>(`select ${COLS} from public.sending_accounts where id = $1`, [id])).rows[0] ?? null;
}

export async function updateMailboxSettings(q: Q, id: string, s: { dailyCap: number; senderName: string | null }) {
  const r = await q.query("update public.sending_accounts set daily_cap = $2, sender_name = $3 where id = $1 returning id", [id, s.dailyCap, s.senderName]);
  return r.rows.length > 0;
}

export async function markMailbox(q: Q, id: string, patch: { status?: MailboxRow["status"]; lastError?: string | null; tested?: boolean }) {
  await q.query(
    `update public.sending_accounts set status = coalesce($2, status), last_error = $3,
       last_tested_at = case when $4 then now() else last_tested_at end where id = $1`,
    [id, patch.status ?? null, patch.lastError?.slice(0, 300) ?? null, !!patch.tested],
  );
}

/* --------------------------------------------------- service connection only */

export async function saveSecret(q: Q, accountId: string, encrypted: Buffer) {
  await q.query(
    `insert into public.sending_account_secrets (account_id, encrypted_tokens, key_version, updated_at) values ($1, $2, 1, now())
     on conflict (account_id) do update set encrypted_tokens = excluded.encrypted_tokens, key_version = 1, updated_at = now()`,
    [accountId, encrypted],
  );
}

export async function loadSecret(q: Q, accountId: string): Promise<Buffer | null> {
  const r = await q.query<{ encrypted_tokens: Buffer | Uint8Array }>("select encrypted_tokens from public.sending_account_secrets where account_id = $1", [accountId]);
  const v = r.rows[0]?.encrypted_tokens;
  return v ? Buffer.from(v) : null;
}

export async function deleteSecret(q: Q, accountId: string) {
  await q.query("delete from public.sending_account_secrets where account_id = $1", [accountId]);
}
