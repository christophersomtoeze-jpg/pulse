-- PULSE Launch Build 3 — production billing reliability
-- Safe to run repeatedly.
-- Tracks webhook processing state so a transient DB/API failure can be retried
-- instead of being permanently treated as a successful event.

alter table public.stripe_webhook_events
  add column if not exists processing_status text not null default 'processed';

alter table public.stripe_webhook_events
  add column if not exists attempt_count integer not null default 1;

alter table public.stripe_webhook_events
  add column if not exists last_error text;

alter table public.stripe_webhook_events
  add constraint stripe_webhook_events_processing_status_check
  check (processing_status in ('processing', 'processed', 'failed'));

create index if not exists stripe_webhook_events_status_idx
  on public.stripe_webhook_events(processing_status, processed_at desc);
