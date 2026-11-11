-- Welcome email: when it was sent, so each account gets it exactly once.
alter table auth.users add column if not exists welcomed_at timestamptz;
