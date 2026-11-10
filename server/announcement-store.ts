import type { Q } from "@/server/auth-store";

/** Service connection only. */

export type Recipient = { user_id: string; email: string; name: string | null };

/**
 * People who get product emails: confirmed accounts (email confirmed, or
 * signed in with Google) that haven't unsubscribed, and, for a send under
 * way, haven't been emailed this announcement yet.
 */
const ELIGIBLE = `
  from auth.users u
  where u.email is not null
    and (u.email_verified_at is not null or u.auth_subject like 'google:%')
    and not exists (select 1 from app.email_optouts o where o.email = lower(u.email))`;

export async function countRecipients(q: Q): Promise<number> {
  return Number((await q.query<{ n: number }>(`select count(*)::int as n ${ELIGIBLE}`)).rows[0]?.n ?? 0);
}

export async function nextRecipients(q: Q, announcementId: string, limit: number): Promise<Recipient[]> {
  return (
    await q.query<Recipient>(
      `select u.id as user_id, lower(u.email) as email, nullif(u.raw_user_meta_data->>'name', '') as name ${ELIGIBLE}
         and not exists (select 1 from app.announcement_sends s where s.announcement_id = $1 and s.user_id = u.id)
       order by u.created_at limit $2`,
      [announcementId, limit],
    )
  ).rows;
}

export async function remainingRecipients(q: Q, announcementId: string): Promise<number> {
  return Number(
    (await q.query<{ n: number }>(`select count(*)::int as n ${ELIGIBLE} and not exists (select 1 from app.announcement_sends s where s.announcement_id = $1 and s.user_id = u.id)`, [announcementId])).rows[0]?.n ?? 0,
  );
}

export async function createAnnouncement(q: Q, a: { template: string | null; subject: string; body: string; createdBy: string }): Promise<string> {
  return (await q.query<{ id: string }>("insert into app.announcements (template, subject, body, created_by) values ($1, $2, $3, $4) returning id", [a.template, a.subject, a.body, a.createdBy])).rows[0].id;
}

export async function getAnnouncement(q: Q, id: string) {
  return (await q.query<{ id: string; subject: string; body: string; status: string }>("select id, subject, body, status from app.announcements where id = $1", [id])).rows[0] ?? null;
}

export async function recordSend(q: Q, announcementId: string, r: Recipient, ok: boolean, error: string | null) {
  await q.query(
    "insert into app.announcement_sends (announcement_id, user_id, email, status, error) values ($1, $2, $3, $4, $5) on conflict (announcement_id, user_id) do nothing",
    [announcementId, r.user_id, r.email, ok ? "sent" : "failed", error?.slice(0, 300) ?? null],
  );
}

export async function finishAnnouncement(q: Q, id: string, status: "sent" | "stopped") {
  await q.query("update app.announcements set status = $2, finished_at = now() where id = $1 and status = 'sending'", [id, status]);
}

export type AnnouncementRow = { id: string; subject: string; status: string; created_by: string; created_at: string; finished_at: string | null; sent: number; failed: number };

export async function listAnnouncements(q: Q, limit = 20): Promise<AnnouncementRow[]> {
  return (
    await q.query<AnnouncementRow>(
      `select a.id, a.subject, a.status, a.created_by, a.created_at, a.finished_at,
         (select count(*)::int from app.announcement_sends s where s.announcement_id = a.id and s.status = 'sent') as sent,
         (select count(*)::int from app.announcement_sends s where s.announcement_id = a.id and s.status = 'failed') as failed
       from app.announcements a order by a.created_at desc limit $1`,
      [limit],
    )
  ).rows;
}

/** Stops product emails to an address (idempotent). */
export async function optOut(q: Q, email: string, source = "unsubscribe_link") {
  await q.query("insert into app.email_optouts (email, source) values ($1, $2) on conflict (email) do nothing", [email.toLowerCase(), source]);
}

export async function optOutCount(q: Q): Promise<number> {
  return Number((await q.query<{ n: number }>("select count(*)::int as n from app.email_optouts")).rows[0]?.n ?? 0);
}
