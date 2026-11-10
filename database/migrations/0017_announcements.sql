-- Announcements: product emails the owner sends to registered users from the
-- admin panel. Server only (service connection); members never see these.
--
-- app.announcements: what was sent and how far it got.
-- app.announcement_sends: one row per person, so a send can resume after a
--   pause without emailing anyone twice.
-- app.email_optouts: people who unsubscribed from product emails. Account
--   emails (confirmations, password resets) are not affected.

create table if not exists app.announcements (
  id uuid primary key default gen_random_uuid(),
  template text check (char_length(template) <= 40),
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 20000),
  created_by text not null check (char_length(created_by) <= 254),
  status text not null default 'sending' check (status in ('sending', 'sent', 'stopped')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists app.announcement_sends (
  announcement_id uuid not null references app.announcements (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null check (char_length(email) <= 254),
  status text not null check (status in ('sent', 'failed')),
  error text check (char_length(error) <= 300),
  sent_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create table if not exists app.email_optouts (
  email text primary key check (email = lower(email) and char_length(email) <= 254),
  source text not null default 'unsubscribe_link' check (char_length(source) <= 40),
  created_at timestamptz not null default now()
);

revoke all on app.announcements, app.announcement_sends, app.email_optouts from public, anon, authenticated;
