-- M3: team invitations and member management.
-- Invites are links carrying a random token; only its SHA-256 is stored.
-- All changes go through the functions below, which check roles in the
-- database: owners and admins invite and manage; nobody can remove or
-- demote the owner; anyone except the owner can leave.

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role text not null check (role in ('admin', 'member')),
  token_hash text not null unique check (char_length(token_hash) = 64),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);
create unique index if not exists workspace_invites_pending_idx on public.workspace_invites (workspace_id, email)
  where accepted_at is null and revoked_at is null;
create index if not exists workspace_invites_email_idx on public.workspace_invites (email) where accepted_at is null and revoked_at is null;
alter table public.workspace_invites enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'workspace_invites' and policyname = 'workspace_invites_admin_select') then
    create policy workspace_invites_admin_select on public.workspace_invites for select to authenticated
      using (app.has_role(workspace_id, array['owner', 'admin']));
  end if;
end $$;
revoke all on public.workspace_invites from anon, authenticated;
grant select (id, workspace_id, email, role, invited_by, created_at, expires_at, accepted_at, revoked_at) on public.workspace_invites to authenticated;

-- Members with their sign-in email, for fellow members only.
create or replace function app.workspace_members(ws uuid)
returns table (user_id uuid, email text, full_name text, role text, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email, p.full_name, m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = ws and app.is_member(ws)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at
$$;

create or replace function app.invite_member(ws uuid, p_email text, p_role text, p_token_hash text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  e text := lower(trim(p_email));
  new_id uuid;
begin
  if not app.has_role(ws, array['owner', 'admin']) then raise exception 'forbidden'; end if;
  if p_role not in ('admin', 'member') then raise exception 'bad_role'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email'; end if;
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.workspace_id = ws and lower(u.email) = e
  ) then raise exception 'already_member'; end if;
  if (select count(*) from public.workspace_invites i
      where i.workspace_id = ws and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()) >= 50 then
    raise exception 'too_many';
  end if;
  -- A new invite replaces an older one for the same address.
  update public.workspace_invites set revoked_at = now()
    where workspace_id = ws and email = e and accepted_at is null and revoked_at is null;
  insert into public.workspace_invites (workspace_id, email, role, token_hash, invited_by)
    values (ws, e, p_role, p_token_hash, auth.uid()) returning id into new_id;
  return new_id;
end $$;

create or replace function app.revoke_invite(p_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
begin
  select workspace_id into ws from public.workspace_invites where id = p_id;
  if ws is null or not app.has_role(ws, array['owner', 'admin']) then return false; end if;
  update public.workspace_invites set revoked_at = now() where id = p_id and accepted_at is null and revoked_at is null;
  return found;
end $$;

-- Joins the workspace when the signed-in person's email matches the invite.
-- Sign-in proves the email (Google's verified email, or a confirmed password
-- account), so an invite can be accepted by id from the app as well as by link.
create or replace function app.accept_invite_id(p_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  inv public.workspace_invites%rowtype;
  my_email text;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  select * into inv from public.workspace_invites where id = p_id for update;
  if inv.id is null or inv.revoked_at is not null then raise exception 'invalid'; end if;
  if inv.accepted_at is not null then
    if inv.accepted_by = auth.uid() then return inv.workspace_id; end if;
    raise exception 'invalid';
  end if;
  if inv.expires_at <= now() then raise exception 'expired'; end if;
  select lower(email) into my_email from auth.users where id = auth.uid();
  if my_email is distinct from inv.email then raise exception 'wrong_email'; end if;
  insert into public.memberships (workspace_id, user_id, role) values (inv.workspace_id, auth.uid(), inv.role)
    on conflict (workspace_id, user_id) do nothing;
  update public.workspace_invites set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return inv.workspace_id;
end $$;

create or replace function app.accept_invite(p_token_hash text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  found_id uuid;
begin
  select id into found_id from public.workspace_invites where token_hash = p_token_hash;
  if found_id is null then raise exception 'invalid'; end if;
  return app.accept_invite_id(found_id);
end $$;

-- Open invites for the signed-in person's email (shown during onboarding).
create or replace function app.my_invites()
returns table (id uuid, workspace_name text, role text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, w.name, i.role, i.expires_at
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  join auth.users u on u.id = auth.uid()
  where i.email = lower(u.email) and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    and not exists (select 1 from public.memberships m where m.workspace_id = i.workspace_id and m.user_id = auth.uid())
  order by i.created_at desc
$$;

create or replace function app.set_member_role(ws uuid, p_user uuid, p_role text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not app.has_role(ws, array['owner', 'admin']) then raise exception 'forbidden'; end if;
  if p_role not in ('admin', 'member') then raise exception 'bad_role'; end if;
  update public.memberships set role = p_role
    where workspace_id = ws and user_id = p_user and role <> 'owner';
  return found;
end $$;

-- Owners and admins remove others; anyone but the owner can remove themselves.
create or replace function app.remove_member(ws uuid, p_user uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or (p_user <> auth.uid() and not app.has_role(ws, array['owner', 'admin'])) then raise exception 'forbidden'; end if;
  delete from public.memberships where workspace_id = ws and user_id = p_user and role <> 'owner';
  return found;
end $$;

revoke all on function app.workspace_members(uuid), app.invite_member(uuid, text, text, text), app.revoke_invite(uuid),
  app.accept_invite(text), app.accept_invite_id(uuid), app.my_invites(), app.set_member_role(uuid, uuid, text), app.remove_member(uuid, uuid) from public;
grant execute on function app.workspace_members(uuid), app.invite_member(uuid, text, text, text), app.revoke_invite(uuid),
  app.accept_invite(text), app.accept_invite_id(uuid), app.my_invites(), app.set_member_role(uuid, uuid, text), app.remove_member(uuid, uuid) to authenticated;
