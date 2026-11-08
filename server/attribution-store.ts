import type { Attribution } from "@/lib/attribution";
import type { Q } from "@/server/auth-store";
import { adminTimeZone } from "@/lib/admin";

/** Service connection. Saves how a new account found us; only for accounts created in the last 30 minutes, and only once. */
export async function recordAttribution(q: Q, userId: string, a: Attribution): Promise<boolean> {
  const r = await q.query(
    `insert into app.signup_attribution (user_id, source, medium, campaign, referrer_host, landing_path)
     select $1, $2, $3, $4, $5, $6
     where exists (select 1 from auth.users u where u.id = $1 and u.created_at > now() - interval '30 minutes')
     on conflict (user_id) do nothing returning user_id`,
    [userId, a.source, a.medium, a.campaign, a.referrerHost, a.landingPath],
  );
  return r.rows.length > 0;
}

/** Service connection. One more anonymous first visit for this source today (UTC). */
export async function bumpVisit(q: Q, source: string) {
  await q.query(
    // Counted per day in the admin panel's time zone, so the daily charts line up with sign-ups and the rest.
    `insert into app.site_visits (day, source, visits) values ((now() at time zone '${adminTimeZone()}')::date, $1, 1)
     on conflict (day, source) do update set visits = app.site_visits.visits + 1`,
    [source],
  );
}
