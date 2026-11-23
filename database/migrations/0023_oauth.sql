-- OAuth 2.1 sign-in for AI apps (ChatGPT, Claude and other MCP clients): the
-- app sends the person to Locenti, they sign in and pick a workspace, and the
-- app gets a token for the MCP server. Service connection only: no RLS policies.

-- Apps that registered themselves (dynamic client registration) or were looked
-- up from their client ID metadata document (client_id is then an https URL).
create table if not exists app.oauth_clients (
  client_id text primary key check (char_length(client_id) between 8 and 500),
  client_name text check (char_length(client_name) <= 120),
  redirect_uris text[] not null,
  source text not null default 'dcr' check (source in ('dcr', 'cimd')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now()
);

-- One-time authorization codes (10 minutes). Only a SHA-256 hash is kept.
create table if not exists app.oauth_codes (
  code_hash text primary key check (char_length(code_hash) = 64),
  client_id text not null references app.oauth_clients (client_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scope text not null default 'locenti',
  resource text,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- A connection between a person's workspace and an app. Access tokens last an
-- hour; refresh tokens rotate on every use. Only hashes are kept.
create table if not exists app.oauth_grants (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references app.oauth_clients (client_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  scope text not null default 'locenti',
  access_hash text unique check (char_length(access_hash) = 64),
  access_expires_at timestamptz,
  refresh_hash text unique check (char_length(refresh_hash) = 64),
  refresh_expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists oauth_grants_user_idx on app.oauth_grants (user_id, workspace_id) where revoked_at is null;

do $$
declare
  t text;
begin
  foreach t in array array['oauth_clients', 'oauth_codes', 'oauth_grants'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('revoke all on app.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on app.%I from authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on app.%I from anon', t);
    end if;
  end loop;
end $$;
