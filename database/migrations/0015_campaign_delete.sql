-- Deleting a campaign hides it and stops anything still waiting; its sent
-- emails stay in the history (analytics, daily sending limits, replies).
alter table public.campaigns add column if not exists deleted_at timestamptz;
create index if not exists campaigns_live_idx on public.campaigns (workspace_id, created_at desc) where deleted_at is null;
