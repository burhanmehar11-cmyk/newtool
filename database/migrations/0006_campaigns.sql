-- Approved campaigns (M2 step 5b).

-- What exactly was approved for each recipient: the address and draft version.
alter table public.enrollments add column if not exists email text check (email = lower(email));
alter table public.enrollments add column if not exists draft_id uuid references public.drafts (id) on delete set null;

-- Which mailbox sent, and when Gmail accepted it (for daily limits and history).
alter table public.dispatches add column if not exists campaign_id uuid references public.campaigns (id) on delete cascade;
alter table public.dispatches add column if not exists sending_account_id uuid references public.sending_accounts (id) on delete set null;
alter table public.dispatches add column if not exists accepted_at timestamptz;
create index if not exists dispatches_account_time_idx on public.dispatches (sending_account_id, attempted_at desc);
create index if not exists enrollments_campaign_state_idx on public.enrollments (campaign_id, state);
