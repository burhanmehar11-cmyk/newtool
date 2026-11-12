-- Mailboxes connected with an App Password over SMTP (sending) and IMAP
-- (reply tracking), instead of Google's Gmail API. Works for Gmail / Google
-- Workspace, Zoho, Hostinger and any IMAP/SMTP server. The password itself is
-- stored encrypted in sending_account_secrets, like OAuth tokens were.
alter table public.sending_accounts drop constraint if exists sending_accounts_provider_check;
alter table public.sending_accounts add constraint sending_accounts_provider_check check (provider in ('gmail', 'smtp'));
alter table public.sending_accounts add column if not exists preset text check (char_length(preset) <= 30);
alter table public.sending_accounts add column if not exists smtp_host text check (char_length(smtp_host) <= 255);
alter table public.sending_accounts add column if not exists smtp_port int check (smtp_port between 1 and 65535);
alter table public.sending_accounts add column if not exists smtp_secure boolean;
alter table public.sending_accounts add column if not exists imap_host text check (char_length(imap_host) <= 255);
alter table public.sending_accounts add column if not exists imap_port int check (imap_port between 1 and 65535);
alter table public.sending_accounts add column if not exists imap_secure boolean;
alter table public.sending_accounts add column if not exists login_username text check (char_length(login_username) <= 254);
