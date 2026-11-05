-- AI: personal access tokens for MCP agents, and draft origins for AI-written drafts.

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  -- SHA-256 of the token; the token itself is shown once and never stored.
  token_hash text not null unique check (char_length(token_hash) = 64),
  prefix text not null check (char_length(prefix) <= 16),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists api_tokens_ws_idx on public.api_tokens (workspace_id, created_at desc);
alter table public.api_tokens enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'api_tokens' and policyname = 'api_tokens_own') then
    -- People see and manage only their own tokens, in workspaces they belong to.
    create policy api_tokens_own on public.api_tokens for all to authenticated
      using (user_id = auth.uid() and app.is_member(workspace_id))
      with check (user_id = auth.uid() and app.is_member(workspace_id));
  end if;
end $$;
grant select, insert, update, delete on public.api_tokens to authenticated;

-- Drafts written by the built-in AI ('ai') or by a connected agent ('agent').
alter table public.drafts drop constraint if exists drafts_origin_check;
alter table public.drafts add constraint drafts_origin_check check (origin in ('generated', 'edited', 'ai', 'agent'));
