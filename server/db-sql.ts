/** SQL shared by the server and the database tests, so tests run exactly what production runs. */
export const USER_SCOPE_SQL = {
  role: "set local role authenticated",
  setUser: "select set_config('app.user_id', $1, true)",
} as const;

export const AUTH_SQL = {
  /** $1 subject, $2 email, $3 display name */
  upsertUser: `insert into auth.users (auth_subject, email, raw_user_meta_data, last_sign_in_at)
     values ($1, $2, jsonb_build_object('full_name', $3::text), now())
     on conflict (auth_subject) do update set email = excluded.email, last_sign_in_at = now()
     returning id`,
  /** $1 user id, $2 lifetime in seconds, $3 user agent */
  createSession: `insert into auth.sessions (user_id, expires_at, user_agent)
     values ($1, now() + make_interval(secs => $2), $3) returning id`,
  /** $1 session id, $2 user id. Valid only if unexpired and not revoked. */
  findSession: `select u.id, u.email from auth.sessions s join auth.users u on u.id = s.user_id
     where s.id = $1 and s.user_id = $2 and s.revoked_at is null and s.expires_at > now()`,
  /** $1 session id */
  revokeSession: "update auth.sessions set revoked_at = now() where id = $1 and revoked_at is null",
} as const;
