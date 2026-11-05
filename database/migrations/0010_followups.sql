-- M3: follow-up emails.
-- Follow-up templates live in public.campaign_steps (positions 1 and 2,
-- kind 'follow_up'); the first email stays the per-recipient draft.
-- An enrollment keeps state 'sent' while a follow-up is pending: step is the
-- next step to send and next_send_at says when. After the last step,
-- next_send_at is null.

-- The Message-ID we set on each email, so follow-ups can reply to it.
alter table public.dispatches add column if not exists rfc_message_id text check (char_length(rfc_message_id) <= 300);

-- Follow-ups waiting to go out.
create index if not exists enrollments_followup_due_idx on public.enrollments (campaign_id, next_send_at)
  where state = 'sent' and next_send_at is not null;

-- Reasonable bounds for follow-up templates (the app checks the same).
alter table public.campaign_steps drop constraint if exists campaign_steps_followup_check;
alter table public.campaign_steps add constraint campaign_steps_followup_check
  check (kind <> 'follow_up' or (position between 1 and 2 and delay_days between 1 and 14 and char_length(body) between 20 and 1000));

-- Before follow-ups, a sent first email kept the next_send_at set at approval.
-- Clear it so those enrollments don't look like a follow-up is waiting.
update public.enrollments set next_send_at = null where state = 'sent' and step = 0 and next_send_at is not null;
