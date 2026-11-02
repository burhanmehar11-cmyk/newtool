-- Website research and email checks. Additive: safe on top of 0000–0002.

alter table public.businesses add column if not exists niche text;
alter table public.businesses add column if not exists researched_at timestamptz;
alter table public.businesses add column if not exists research_status text
  check (research_status in ('ok', 'partial', 'no_website', 'blocked', 'failed'));
alter table public.businesses add column if not exists research_note text check (char_length(research_note) <= 1000);
-- Signals read from the website (null = Unknown), kept for re-scoring when the offer changes.
alter table public.businesses add column if not exists signals jsonb;

alter table public.contacts add column if not exists verification_detail text check (char_length(verification_detail) <= 300);
