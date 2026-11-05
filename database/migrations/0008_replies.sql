-- Reply sync (M2 step 6).
alter table public.sending_accounts add column if not exists last_synced_at timestamptz;
alter table public.threads add column if not exists sending_account_id uuid references public.sending_accounts (id) on delete set null;
alter table public.threads add column if not exists last_inbound_at timestamptz;
alter table public.threads drop constraint if exists threads_classification_check;
alter table public.threads add constraint threads_classification_check
  check (classification in ('interested', 'not_interested', 'out_of_office', 'bounce', 'unclassified'));
create index if not exists threads_inbound_idx on public.threads (workspace_id, last_inbound_at desc) where last_inbound_at is not null;
