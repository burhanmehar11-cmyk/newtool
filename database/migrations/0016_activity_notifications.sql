-- Activity log and notifications.
--
-- app.activity_events: everything people do and what came of it (success,
-- failed, warning, info), for the owner's admin panel. Server only: written
-- and read through the service connection, never by workspace members.
--
-- public.notifications: messages for one person in a workspace (a reply came
-- in, a campaign finished, a mailbox needs reconnecting...). Each member reads
-- and marks only their own; rows are created by the server.

create table if not exists app.activity_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  email text check (char_length(email) <= 254),
  kind text not null check (char_length(kind) <= 40),
  area text not null check (area in ('account', 'team', 'mailbox', 'prospecting', 'research', 'writing', 'campaign', 'sending', 'replies', 'agents', 'billing')),
  outcome text not null check (outcome in ('success', 'failed', 'warning', 'info')),
  summary text not null check (char_length(summary) <= 500),
  details jsonb not null default '{}'
);
create index if not exists activity_events_at_idx on app.activity_events (at desc);
create index if not exists activity_events_area_idx on app.activity_events (area, at desc);
create index if not exists activity_events_failed_idx on app.activity_events (at desc) where outcome = 'failed';
revoke all on app.activity_events from public, anon, authenticated;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (char_length(kind) <= 40),
  level text not null default 'info' check (level in ('success', 'failed', 'warning', 'info')),
  title text not null check (char_length(title) <= 160),
  body text not null default '' check (char_length(body) <= 600),
  href text check (href is null or (char_length(href) <= 300 and href like '/%')),
  -- Repeats of the same thing (e.g. one per campaign) are stored once.
  dedupe_key text check (char_length(dedupe_key) <= 200),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, workspace_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id, workspace_id) where read_at is null;
create unique index if not exists notifications_dedupe_idx on public.notifications (user_id, workspace_id, dedupe_key) where dedupe_key is not null;

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select, update (read_at) on public.notifications to authenticated;
drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = auth.uid() and app.is_member(workspace_id));
drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
