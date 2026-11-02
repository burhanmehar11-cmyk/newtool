-- Locentio M2 foundation schema.
--
-- Targets Supabase Postgres (auth.users, auth.uid(), roles anon /
-- authenticated / service_role). Every workspace-owned row carries
-- workspace_id and is protected by row-level security. Operations that must
-- not be performed directly by clients (creating workspaces, writing the
-- usage ledger) go through SECURITY DEFINER functions that re-check
-- membership themselves.


create schema if not exists app;
grant usage on schema app to authenticated;

-- ------------------------------------------------------------------ helpers

create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ------------------------------------------------------- people and tenancy

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger workspaces_touch before update on public.workspaces
  for each row execute function app.touch_updated_at();

-- Roles: owner and member are used in M2; admin, operator and viewer arrive in M3.
create table public.memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create or replace function app.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = auth.uid()
  )
$$;

create or replace function app.has_role(ws uuid, roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role = any (roles)
  )
$$;

grant execute on function app.is_member(uuid) to authenticated;
grant execute on function app.has_role(uuid, text[]) to authenticated;

-- Create a profile row for every new auth user.
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- --------------------------------------------------------------- the offer

create table public.offer_profiles (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  service_type text not null check (service_type in ('local_seo', 'web_design', 'ai_automation', 'marketing')),
  service text not null check (char_length(service) <= 120),
  target_customer text not null check (char_length(target_customer) <= 160),
  value_prop text not null check (char_length(value_prop) <= 400),
  tone text not null check (tone in ('friendly', 'direct', 'consultative')),
  sender_name text not null check (char_length(sender_name) <= 80),
  sender_title text not null default '' check (char_length(sender_title) <= 80),
  company_name text not null check (char_length(company_name) <= 120),
  business_address text not null check (char_length(business_address) <= 200),
  booking_link text not null default '' check (booking_link = '' or booking_link ~ '^https://'),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger offer_profiles_touch before update on public.offer_profiles
  for each row execute function app.touch_updated_at();

-- --------------------------------------------------------------- discovery

create table public.discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  query text not null default '' check (char_length(query) <= 300),
  filters jsonb not null,
  provider text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'partial', 'completed', 'failed', 'cancelled')),
  estimated_units int not null check (estimated_units >= 0),
  charged_units int not null default 0 check (charged_units >= 0),
  reservation_key text,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index discovery_jobs_ws_idx on public.discovery_jobs (workspace_id, created_at desc);

create table public.discovery_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_id uuid not null references public.discovery_jobs (id) on delete cascade,
  page_index int not null check (page_index >= 0),
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  cursor text,
  result_count int not null default 0,
  error text,
  updated_at timestamptz not null default now(),
  unique (job_id, page_index)
);

-- Businesses are stored per workspace: provider terms may limit sharing and
-- retention, and nothing leaks between tenants.
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null,
  provider_ref text not null,
  name text not null,
  category text,
  address text,
  city text,
  region text,
  phone text,
  website text,
  domain_normalized text,
  rating numeric(2, 1) check (rating between 0 and 5),
  review_count int check (review_count >= 0),
  attribution text,
  collected_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, provider_ref)
);
-- Branches of a chain may share a website, so the domain is indexed, not unique.
create index businesses_domain_idx on public.businesses (workspace_id, domain_normalized);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('listing', 'homepage', 'contact_page', 'reviews', 'forms_page', 'other')),
  label text not null,
  url text not null check (url ~ '^https?://'),
  excerpt text not null check (char_length(excerpt) <= 4000),
  content_hash text,
  collected_at timestamptz not null
);
create index evidence_business_idx on public.evidence (business_id);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  email_normalized text not null check (email_normalized = lower(email_normalized) and email_normalized ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  kind text not null default 'role' check (kind in ('role', 'named')),
  source_evidence_id uuid references public.evidence (id) on delete set null,
  -- MX existence alone must never be recorded as 'valid'.
  status text not null default 'unverified' check (status in ('unverified', 'valid', 'invalid', 'catch_all', 'unknown')),
  verified_at timestamptz,
  verification_provider text,
  created_at timestamptz not null default now(),
  unique (workspace_id, email_normalized),
  check ((status = 'unverified') = (verified_at is null))
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  source text not null check (source in ('search', 'import')),
  notes text not null default '' check (char_length(notes) <= 5000),
  saved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, business_id)
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.list_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  primary key (list_id, lead_id)
);

create table public.lead_tags (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  tag text not null check (tag = lower(tag) and char_length(tag) between 1 and 40),
  primary key (lead_id, tag)
);

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  offer_type text not null,
  payload jsonb not null,
  generator text not null check (generator in ('ai', 'template')),
  model text,
  created_at timestamptz not null default now()
);
create index briefs_business_idx on public.briefs (business_id, created_at desc);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  version int not null check (version > 0),
  subject text not null check (char_length(subject) between 1 and 140),
  body text not null check (char_length(body) between 1 and 8000),
  fact_ids jsonb not null default '[]',
  origin text not null check (origin in ('generated', 'edited')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (lead_id, version)
);

-- ---------------------------------------------------------------- campaigns

create table public.sending_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('gmail')),
  email text not null,
  status text not null default 'connected' check (status in ('connected', 'needs_reconnect', 'revoked', 'disconnected')),
  daily_cap int not null default 25 check (daily_cap between 1 and 200),
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

-- Encrypted mailbox tokens. No RLS policies: only the service role can read them.
create table public.sending_account_secrets (
  account_id uuid primary key references public.sending_accounts (id) on delete cascade,
  encrypted_tokens bytea not null,
  key_version int not null default 1,
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'completed', 'cancelled')),
  -- Increments on any change to recipients, content, schedule or policy.
  revision int not null default 1 check (revision > 0),
  sending_account_id uuid references public.sending_accounts (id) on delete set null,
  schedule jsonb not null,
  policy jsonb not null default '{"includeCatchAll": false, "includeUnknown": false}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  launched_at timestamptz
);
create trigger campaigns_touch before update on public.campaigns
  for each row execute function app.touch_updated_at();

create table public.campaign_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  position int not null check (position >= 0),
  kind text not null check (kind in ('initial', 'follow_up')),
  delay_days int not null default 0 check (delay_days between 0 and 30),
  subject text not null default '',
  body text not null default '',
  unique (campaign_id, position)
);

create table public.campaign_recipients (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  primary key (campaign_id, lead_id)
);

-- Approval is bound to an exact campaign revision and the draft versions reviewed.
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  revision int not null,
  recipient_lead_ids uuid[] not null,
  draft_versions jsonb not null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz not null default now(),
  unique (campaign_id, revision)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  state text not null default 'queued' check (state in ('queued', 'sent', 'replied', 'stopped')),
  reason text,
  step int not null default 0 check (step >= 0),
  next_send_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);
-- No duplicate active outreach to the same address across campaigns.
create unique index enrollments_one_active_per_contact
  on public.enrollments (workspace_id, contact_id) where state in ('queued', 'sent');

-- One dispatch per (enrollment, step). A timeout after provider acceptance
-- is reconciled by dispatch id, never blindly resent.
create table public.dispatches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  step int not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'accepted', 'failed', 'ambiguous', 'cancelled')),
  provider_message_id text,
  attempted_at timestamptz,
  error text,
  unique (enrollment_id, step)
);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  provider_thread_id text not null,
  subject text not null default '',
  classification text not null default 'unclassified'
    check (classification in ('interested', 'not_interested', 'out_of_office', 'unclassified')),
  classification_source text not null default 'suggested' check (classification_source in ('suggested', 'user')),
  unread boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider_thread_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  provider_message_id text not null,
  from_addr text not null,
  to_addr text not null,
  subject text not null default '',
  body_text text not null default '',
  -- Only sanitised HTML is ever stored.
  body_html_sanitized text,
  occurred_at timestamptz not null,
  unique (workspace_id, provider_message_id)
);

-- Workspace-wide; survives lead deletion and re-import.
create table public.suppression_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  value text not null check (value = lower(value)),
  kind text not null check (kind in ('email', 'domain')),
  reason text not null check (reason in ('unsubscribe', 'manual', 'bounce', 'complaint')),
  note text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, value)
);

-- -------------------------------------------------------------------- usage

create table public.workspace_allowances (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('discovery', 'verification', 'ai')),
  units int not null check (units >= 0),
  primary key (workspace_id, kind)
);

create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('discovery', 'verification', 'ai')),
  entry_type text not null check (entry_type in ('reserve', 'charge', 'release', 'refund')),
  units int not null check (units > 0),
  -- Groups charge/release/refund entries with the reservation they settle.
  reservation_key text,
  -- Retries with the same key never create a second entry.
  idempotency_key text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);
create index usage_ledger_ws_kind_idx on public.usage_ledger (workspace_id, kind);

-- ------------------------------------------------------------- operations

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_type text not null,
  external_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_events_ws_idx on public.audit_events (workspace_id, created_at desc);

-- -------------------------------------------------------- row-level security

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.sending_account_secrets enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Workspaces are created only through app.create_workspace().
create policy workspaces_member_select on public.workspaces for select to authenticated using (app.is_member(id));
create policy workspaces_owner_update on public.workspaces for update to authenticated
  using (app.has_role(id, array['owner', 'admin'])) with check (app.has_role(id, array['owner', 'admin']));

-- Memberships are visible to fellow members; changes go through functions (M3 invitations).
create policy memberships_member_select on public.memberships for select to authenticated using (app.is_member(workspace_id));

-- Generic member access for workspace-owned tables. Viewer write
-- restrictions arrive with M3 roles.
do $$
declare
  t text;
begin
  foreach t in array array[
    'offer_profiles', 'discovery_jobs', 'discovery_pages', 'businesses', 'evidence', 'contacts', 'leads',
    'lists', 'list_members', 'lead_tags', 'briefs', 'drafts', 'sending_accounts', 'campaigns',
    'campaign_steps', 'campaign_recipients', 'approvals', 'enrollments', 'dispatches', 'threads',
    'messages', 'suppression_entries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (app.is_member(workspace_id)) with check (app.is_member(workspace_id))',
      t || '_member_all', t
    );
  end loop;
end $$;

-- Read-only to members; written only by SECURITY DEFINER functions or the service role.
alter table public.workspace_allowances enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.job_runs enable row level security;
alter table public.audit_events enable row level security;
create policy workspace_allowances_member_select on public.workspace_allowances for select to authenticated using (app.is_member(workspace_id));
create policy usage_ledger_member_select on public.usage_ledger for select to authenticated using (app.is_member(workspace_id));
create policy job_runs_member_select on public.job_runs for select to authenticated using (app.is_member(workspace_id));
create policy audit_events_member_select on public.audit_events for select to authenticated using (app.is_member(workspace_id));

-- Defence in depth: anonymous visitors get nothing, and clients cannot write
-- ledger, allowance, audit or secret tables directly.
revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.usage_ledger, public.workspace_allowances, public.audit_events, public.job_runs from authenticated;
revoke all on public.sending_account_secrets from authenticated;

-- --------------------------------------------------------------- functions

-- RPC-callable (public schema). Create a workspace with the caller as owner, default beta allowances and an audit event.
create or replace function public.create_workspace(ws_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ws uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  insert into public.workspaces (name, created_by) values (trim(ws_name), uid) returning id into ws;
  insert into public.memberships (workspace_id, user_id, role) values (ws, uid, 'owner');
  insert into public.workspace_allowances (workspace_id, kind, units)
    values (ws, 'discovery', 500), (ws, 'verification', 250), (ws, 'ai', 300);
  insert into public.audit_events (workspace_id, actor_id, action, target_type, target_id)
    values (ws, uid, 'workspace.created', 'workspace', ws::text);
  return ws;
end $$;

-- Units currently committed: charges minus refunds, plus reservations not yet settled.
create or replace function app.committed_units(ws uuid, usage_kind text) returns int
language sql stable security definer set search_path = '' as $$
  with l as (
    select * from public.usage_ledger where workspace_id = ws and kind = usage_kind
  ),
  open_reservations as (
    select r.units - coalesce((
      select sum(s.units) from l s
      where s.reservation_key = r.idempotency_key and s.entry_type in ('charge', 'release')
    ), 0) as held
    from l r where r.entry_type = 'reserve'
  )
  select (
    coalesce((select sum(units) from l where entry_type = 'charge'), 0)
    - coalesce((select sum(units) from l where entry_type = 'refund'), 0)
    + coalesce((select sum(greatest(held, 0)) from open_reservations), 0)
  )::int
$$;

-- Reserve units before work starts. Serialised per workspace and kind by
-- locking the allowance row, so concurrent jobs cannot overspend. Calling
-- again with the same key returns the existing reservation.
create or replace function public.reserve_usage(ws uuid, usage_kind text, amount int, key text, note text default '')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  allowance int;
  committed int;
  existing public.usage_ledger;
begin
  if not app.is_member(ws) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select units into allowance from public.workspace_allowances
    where workspace_id = ws and kind = usage_kind for update;
  if allowance is null then
    raise exception 'no_allowance' using errcode = 'P0001';
  end if;

  select * into existing from public.usage_ledger where workspace_id = ws and idempotency_key = key;
  if found then
    return jsonb_build_object('reserved', existing.units, 'idempotent', true);
  end if;

  committed := app.committed_units(ws, usage_kind);
  if committed + amount > allowance then
    raise exception 'quota_exceeded' using errcode = 'P0001',
      detail = format('requested %s, available %s', amount, greatest(allowance - committed, 0));
  end if;

  insert into public.usage_ledger (workspace_id, kind, entry_type, units, reservation_key, idempotency_key, note)
    values (ws, usage_kind, 'reserve', amount, null, key, note);
  return jsonb_build_object('reserved', amount, 'idempotent', false, 'available', allowance - committed - amount);
end $$;

-- Settle a reservation: charge what was used and release the rest. Idempotent.
create or replace function public.settle_usage(ws uuid, key text, used int, note text default '')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.usage_ledger;
  charge int;
begin
  if not app.is_member(ws) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.usage_ledger
    where workspace_id = ws and idempotency_key = key and entry_type = 'reserve' for update;
  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.usage_ledger where workspace_id = ws and reservation_key = key) then
    return jsonb_build_object('settled', true, 'idempotent', true);
  end if;
  charge := least(greatest(used, 0), r.units);
  if charge > 0 then
    insert into public.usage_ledger (workspace_id, kind, entry_type, units, reservation_key, idempotency_key, note)
      values (ws, r.kind, 'charge', charge, key, key || ':charge', note);
  end if;
  if r.units - charge > 0 then
    insert into public.usage_ledger (workspace_id, kind, entry_type, units, reservation_key, idempotency_key, note)
      values (ws, r.kind, 'release', r.units - charge, key, key || ':release', 'Unused reservation returned');
  end if;
  return jsonb_build_object('settled', true, 'idempotent', false, 'charged', charge, 'released', r.units - charge);
end $$;

-- Functions are executable by PUBLIC by default; narrow that explicitly.
revoke execute on function app.committed_units(uuid, text) from public;
revoke execute on function app.handle_new_user() from public;
revoke execute on function public.create_workspace(text) from public, anon;
revoke execute on function public.reserve_usage(uuid, text, int, text, text) from public, anon;
revoke execute on function public.settle_usage(uuid, text, int, text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.reserve_usage(uuid, text, int, text, text) to authenticated;
grant execute on function public.settle_usage(uuid, text, int, text) to authenticated;
