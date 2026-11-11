-- Admins added from the admin panel (Admin → Admins), next to the owners in
-- ADMIN_EMAILS, who are permanent. Server only.
create table if not exists app.admin_users (
  email text primary key check (email = lower(email) and char_length(email) <= 254),
  added_by text not null check (char_length(added_by) <= 254),
  created_at timestamptz not null default now()
);
revoke all on app.admin_users from public, anon, authenticated;
