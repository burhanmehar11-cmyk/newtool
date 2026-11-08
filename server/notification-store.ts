import type { Q } from "@/server/auth-store";

/** A person's notifications in one workspace (row-level security limits reads and updates to their own). */
export type NotificationRow = { id: string; kind: string; level: "success" | "failed" | "warning" | "info"; title: string; body: string; href: string | null; created_at: string; age_s: number; read: boolean };

export async function listNotifications(q: Q, ws: string, opts: { unreadOnly?: boolean; limit?: number } = {}): Promise<NotificationRow[]> {
  return (
    await q.query<NotificationRow>(
      `select id, kind, level, title, body, href, created_at, extract(epoch from now() - created_at)::int as age_s, read_at is not null as read
       from public.notifications where workspace_id = $1 and user_id = auth.uid() and ($2 = false or read_at is null)
       order by created_at desc limit $3`,
      [ws, !!opts.unreadOnly, opts.limit ?? 100],
    )
  ).rows;
}

export async function unreadCount(q: Q, ws: string): Promise<number> {
  return Number((await q.query<{ n: number }>("select count(*)::int as n from public.notifications where workspace_id = $1 and user_id = auth.uid() and read_at is null", [ws])).rows[0]?.n ?? 0);
}

/** Marks one notification (or, without an id, all of them) as read. */
export async function markNotificationsRead(q: Q, ws: string, id?: string): Promise<number> {
  const r = await q.query(
    "update public.notifications set read_at = now() where workspace_id = $1 and user_id = auth.uid() and read_at is null and ($2::uuid is null or id = $2) returning id",
    [ws, id ?? null],
  );
  return r.rows.length;
}
