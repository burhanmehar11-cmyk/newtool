-- Gmail mailbox connection details (M2 step 5).
alter table public.sending_accounts add column if not exists sender_name text check (char_length(sender_name) <= 80);
alter table public.sending_accounts add column if not exists scopes text check (char_length(scopes) <= 1000);
alter table public.sending_accounts add column if not exists last_tested_at timestamptz;
alter table public.sending_accounts add column if not exists last_error text check (char_length(last_error) <= 300);

-- Token storage stays service-only: RLS is on with no policies, and signed-in
-- users lose the blanket table grant from 0001 as well.
revoke all on public.sending_account_secrets from authenticated;
