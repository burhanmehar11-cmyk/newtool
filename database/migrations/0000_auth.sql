-- Identity and roles for plain PostgreSQL (Cloud SQL).
--
-- Firebase Authentication proves who the user is. The app server verifies
-- the Firebase session, maps the Firebase UID to an internal UUID in
-- auth.users, and runs each user query inside a transaction with
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
  firebase_uid text not null unique check (char_length(firebase_uid) between 1 and 128),
  email text,
  raw_user_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
-- Only the server (connecting role) reads or writes auth.users directly.
revoke all on auth.users from public, authenticated, anon;
