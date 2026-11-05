-- M3: viewer role (read-only members).
-- Every "<table>_member_all" policy becomes two: members (any role) can read,
-- and only owners, admins and members can insert, update or delete. The app
-- also checks this, so viewers see a friendly "view-only" message.

do $$
declare
  r record;
begin
  for r in select tablename from pg_policies where schemaname = 'public' and policyname = tablename || '_member_all' loop
    execute format('drop policy %I on public.%I', r.tablename || '_member_all', r.tablename);
    execute format('create policy %I on public.%I for select to authenticated using (app.is_member(workspace_id))', r.tablename || '_member_read', r.tablename);
    execute format(
      'create policy %I on public.%I for all to authenticated using (app.has_role(workspace_id, array[''owner'', ''admin'', ''member''])) with check (app.has_role(workspace_id, array[''owner'', ''admin'', ''member'']))',
      r.tablename || '_member_write', r.tablename
    );
  end loop;
end $$;

-- Invites and role changes can now use 'viewer'.
alter table public.workspace_invites drop constraint if exists workspace_invites_role_check;
alter table public.workspace_invites add constraint workspace_invites_role_check check (role in ('admin', 'member', 'viewer'));

create or replace function app.invite_member(ws uuid, p_email text, p_role text, p_token_hash text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  e text := lower(trim(p_email));
  new_id uuid;
begin
  if not app.has_role(ws, array['owner', 'admin']) then raise exception 'forbidden'; end if;
  if p_role not in ('admin', 'member', 'viewer') then raise exception 'bad_role'; end if;
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

create or replace function app.set_member_role(ws uuid, p_user uuid, p_role text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not app.has_role(ws, array['owner', 'admin']) then raise exception 'forbidden'; end if;
  if p_role not in ('admin', 'member', 'viewer') then raise exception 'bad_role'; end if;
  update public.memberships set role = p_role
    where workspace_id = ws and user_id = p_user and role <> 'owner';
  return found;
end $$;
