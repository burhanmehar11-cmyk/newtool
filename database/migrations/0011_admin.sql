-- Admin panel: workspace plans, sign-up sources, anonymous visit counts and
-- an audit log of admin actions. The app tables here are service-only; the
-- admin panel reads them on the service connection after checking ADMIN_EMAILS.

-- Plans. Nothing is enforced or billed yet: an admin sets them by hand until
-- billing exists. A trial ends at trial_ends_at, or TRIAL_DAYS after creation.
alter table public.workspaces add column if not exists plan text not null default 'trial'
  check (plan in ('trial', 'free', 'paid', 'comp'));
alter table public.workspaces add column if not exists trial_ends_at timestamptz;
alter table public.workspaces add column if not exists plan_note text check (char_length(plan_note) <= 300);
alter table public.workspaces add column if not exists plan_updated_at timestamptz;
-- Owners and admins may rename their workspace, but never change its plan.
revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;

-- How each person found Locenti (first visit), saved once when they sign up.
create table if not exists app.signup_attribution (
  user_id uuid primary key references auth.users (id) on delete cascade,
  source text not null check (char_length(source) between 1 and 80),
  medium text check (char_length(medium) <= 80),
  campaign text check (char_length(campaign) <= 120),
  referrer_host text check (char_length(referrer_host) <= 200),
  landing_path text check (char_length(landing_path) <= 300),
  created_at timestamptz not null default now()
);

-- Anonymous daily totals of first visits per source: no cookies, IPs or ids.
create table if not exists app.site_visits (
  day date not null,
  source text not null check (char_length(source) between 1 and 80),
  visits int not null default 0 check (visits >= 0),
  primary key (day, source)
);

create table if not exists app.admin_audit (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null check (char_length(admin_email) <= 254),
  action text not null check (char_length(action) <= 60),
  target text check (char_length(target) <= 200),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_time_idx on app.admin_audit (created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['signup_attribution', 'site_visits', 'admin_audit'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('revoke all on app.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on app.%I from authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on app.%I from anon', t);
    end if;
  end loop;
end $$;
