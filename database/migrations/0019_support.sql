-- Support: requests from users and the owner's replies.
--
-- public.support_tickets / public.support_messages: a person sees and adds to
-- only their own requests (row-level security), and never sees internal
-- notes. The owner's admin panel works through the service connection.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  email text not null check (char_length(email) <= 254),
  subject text not null check (char_length(subject) between 1 and 200),
  topic text not null default 'other' check (topic in ('account', 'billing', 'search', 'mailbox', 'campaigns', 'bug', 'feature', 'other')),
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  -- app: opened by the user in Locenti; admin: started by the owner with "Message".
  channel text not null default 'app' check (channel in ('app', 'admin')),
  -- needs_reply: the user is waiting on us; waiting: we answered, waiting on them; resolved.
  status text not null default 'needs_reply' check (status in ('needs_reply', 'waiting', 'resolved')),
  assigned_to text check (char_length(assigned_to) <= 254),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_customer_at timestamptz,
  last_admin_at timestamptz,
  resolved_at timestamptz
);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, updated_at desc);
create index if not exists support_tickets_queue_idx on public.support_tickets (status, updated_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author text not null check (author in ('customer', 'admin', 'system')),
  author_email text check (char_length(author_email) <= 254),
  body text not null check (char_length(body) between 1 and 10000),
  -- Internal notes are only for the owner and admins.
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets, public.support_messages from public, anon, authenticated;
grant select, insert on public.support_tickets to authenticated;
grant update (status, updated_at, last_customer_at, resolved_at) on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;

drop policy if exists support_tickets_own on public.support_tickets;
create policy support_tickets_own on public.support_tickets for select to authenticated using (user_id = auth.uid());
drop policy if exists support_tickets_open on public.support_tickets;
create policy support_tickets_open on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid() and channel = 'app' and status = 'needs_reply' and assigned_to is null and (workspace_id is null or app.is_member(workspace_id)));
drop policy if exists support_tickets_touch on public.support_tickets;
create policy support_tickets_touch on public.support_tickets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists support_messages_own on public.support_messages;
create policy support_messages_own on public.support_messages for select to authenticated
  using (not internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
drop policy if exists support_messages_write on public.support_messages;
create policy support_messages_write on public.support_messages for insert to authenticated
  with check (author = 'customer' and not internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
