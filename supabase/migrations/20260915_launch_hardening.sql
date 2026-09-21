-- PULSE Launch Hardening 1.0
-- Safe to run repeatedly. Adds Stripe webhook idempotency and server-side
-- billing-event audit storage so retries cannot double-apply subscription state.

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

-- Stripe webhook events are server-side records. No client role gets access.
drop policy if exists stripe_webhook_events_no_client_access on public.stripe_webhook_events;

create index if not exists stripe_webhook_events_processed_at_idx
  on public.stripe_webhook_events(processed_at desc);

-- Keep the table bounded. This function is intended for an admin/cron job.
create or replace function public.prune_stripe_webhook_events(retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare deleted_count integer;
begin
  delete from public.stripe_webhook_events
  where processed_at < now() - make_interval(days => greatest(retention_days, 7));
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
