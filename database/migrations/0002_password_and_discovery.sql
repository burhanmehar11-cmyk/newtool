-- Adds email + password sign-in and links discovery jobs to their results.
-- Additive only: safe to run on a database that already has 0000 and 0001.

-- ------------------------------------------------------------- passwords

alter table auth.users add column if not exists password_hash text;
alter table auth.users add column if not exists email_verified_at timestamptz;

-- One account per email address (case-insensitive). Google and password
-- sign-in for the same verified email resolve to the same user.
create unique index if not exists users_email_unique on auth.users (lower(email));

-- Single-use links for email verification and password reset. Only a
-- SHA-256 hash of the token is stored.
create table if not exists auth.email_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('verify_email', 'reset_password')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_tokens_user_idx on auth.email_tokens (user_id, purpose);

-- Failed sign-in attempts, used to slow down password guessing.
create table if not exists auth.sign_in_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ip text,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists sign_in_attempts_email_idx on auth.sign_in_attempts (lower(email), created_at desc);

revoke all on auth.email_tokens, auth.sign_in_attempts from public, authenticated, anon;

-- Existing Google users have verified emails.
update auth.users set email_verified_at = coalesce(email_verified_at, created_at) where auth_subject like 'google:%';

-- -------------------------------------------------------------- discovery

-- Which businesses a discovery job returned, in order.
create table if not exists public.discovery_results (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_id uuid not null references public.discovery_jobs (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  position int not null check (position >= 0),
  primary key (job_id, business_id)
);
alter table public.discovery_results enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'discovery_results' and policyname = 'discovery_results_member_all') then
    create policy discovery_results_member_all on public.discovery_results for all to authenticated
      using (app.is_member(workspace_id)) with check (app.is_member(workspace_id));
  end if;
end $$;
grant select, insert, update, delete on public.discovery_results to authenticated;
