-- Google Maps listings via the official Places API (New).
--
-- Google's terms forbid caching Places content except place IDs (indefinitely)
-- and coordinates (30 days), and forbid copying business names, addresses or
-- reviews. So Google results are shown live and never stored; a saved lead
-- keeps only the place ID plus what Locentio reads from the business's own
-- website. See docs/DECISIONS.md.

-- One API key serves every workspace, so the daily call limit is global.
-- Service-only: RLS on with no policies, no grants to app roles.
create table if not exists app.provider_daily_calls (
  provider text not null check (char_length(provider) <= 40),
  day date not null,
  calls int not null default 0 check (calls >= 0),
  primary key (provider, day)
);
alter table app.provider_daily_calls enable row level security;
revoke all on app.provider_daily_calls from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.provider_daily_calls from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.provider_daily_calls from anon';
  end if;
end $$;
