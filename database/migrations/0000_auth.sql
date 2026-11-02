-- Identity and roles for plain PostgreSQL (e.g. Neon via Vercel, or any Postgres 15+).
--
-- "Sign in with Google" (OAuth 2.0 / OpenID Connect) proves who the user is.
-- The app server verifies Google's ID token, maps the Google subject to an
-- internal UUID in auth.users, issues its own revocable session, and runs
-- each user query inside a transaction with
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('app.user_id', '<uuid>', true);
-- so row-level security policies can use auth.uid().

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

-- The login role that runs migrations and the app must be able to switch into `authenticated`.
grant authenticated to current_user;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  -- Provider-qualified subject, e.g. "google:1234567890". Stable per Google account.
  auth_subject text not null unique check (char_length(auth_subject) between 3 and 160),
  email text,
  raw_user_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

-- Server-issued sessions. The cookie carries only a signed session id; signing
-- out or revoking here invalidates it immediately.
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text check (char_length(user_agent) <= 300)
);
create index if not exists sessions_user_idx on auth.sessions (user_id);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
-- Only the server (connecting role) reads or writes auth.users and auth.sessions.
revoke all on auth.users, auth.sessions from public, authenticated, anon;
