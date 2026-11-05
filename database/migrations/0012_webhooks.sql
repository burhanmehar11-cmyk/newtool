-- M3: signed webhooks. Endpoints and deliveries are read and written only on
-- the service connection, after the app checks the person is a workspace
-- owner or admin. The signing secret is stored encrypted and shown once.

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  events text[] not null check (cardinality(events) between 1 and 10
    and events <@ array['lead.created', 'email.sent', 'reply.received', 'campaign.completed']::text[]),
  secret_enc bytea not null,
  secret_prefix text not null check (char_length(secret_prefix) <= 16),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  disabled_at timestamptz,
  disabled_reason text check (char_length(disabled_reason) <= 200),
  failures int not null default 0 check (failures >= 0),
  last_delivery_at timestamptz,
  last_status text check (char_length(last_status) <= 200)
);
create index if not exists webhook_endpoints_ws_idx on public.webhook_endpoints (workspace_id);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints (id) on delete cascade,
  event text not null check (char_length(event) <= 40),
  -- One delivery per endpoint, event and subject (a lead, message or campaign), so retries and repeats never double-send.
  dedupe_key text not null check (char_length(dedupe_key) <= 200),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts int not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_status int,
  last_error text check (char_length(last_error) <= 300),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (endpoint_id, event, dedupe_key)
);
create index if not exists webhook_deliveries_due_idx on public.webhook_deliveries (next_attempt_at) where status = 'pending';
create index if not exists webhook_deliveries_ws_idx on public.webhook_deliveries (workspace_id, created_at desc);

alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
revoke all on public.webhook_endpoints from anon, authenticated;
revoke all on public.webhook_deliveries from anon, authenticated;
