-- Billing: one subscription record per workspace and a log of provider
-- events (each stored once). Service connection only: the app checks the
-- person is an owner or admin before showing billing details.
-- A workspace's plan follows its subscription: active/trialing/past_due ->
-- 'paid', canceled -> 'lapsed'. Admins can still set plans by hand.

alter table public.workspaces drop constraint if exists workspaces_plan_check;
alter table public.workspaces add constraint workspaces_plan_check check (plan in ('trial', 'free', 'paid', 'comp', 'lapsed'));

create table if not exists app.billing_accounts (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('paddle')),
  customer_id text check (char_length(customer_id) <= 100),
  subscription_id text unique check (char_length(subscription_id) <= 100),
  status text check (status in ('active', 'trialing', 'past_due', 'paused', 'canceled')),
  plan_id text check (char_length(plan_id) <= 40),
  price_id text check (char_length(price_id) <= 100),
  period_ends_at timestamptz,
  cancel_at timestamptz,
  manage_url text check (char_length(manage_url) <= 1000),
  cancel_url text check (char_length(cancel_url) <= 1000),
  updated_at timestamptz not null default now()
);

create table if not exists app.billing_events (
  provider text not null,
  event_id text not null check (char_length(event_id) <= 100),
  type text not null check (char_length(type) <= 60),
  workspace_id uuid references public.workspaces (id) on delete set null,
  occurred_at timestamptz,
  -- For completed payments: amount in the currency's minor unit (e.g. cents).
  amount_minor bigint,
  currency text check (char_length(currency) <= 3),
  payload jsonb not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);
create index if not exists billing_events_time_idx on app.billing_events (received_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['billing_accounts', 'billing_events'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('revoke all on app.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on app.%I from authenticated', t); end if;
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on app.%I from anon', t); end if;
  end loop;
end $$;
