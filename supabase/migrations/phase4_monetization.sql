-- Phase 4 — Monetization: plans, AI credits, usage tracking
-- Run in Supabase SQL Editor after schema.sql

-- Expand plan check to include starter
alter table public.workspace_subscriptions drop constraint if exists workspace_subscriptions_plan_check;
alter table public.workspace_subscriptions
  add constraint workspace_subscriptions_plan_check
  check (plan in ('free', 'starter', 'pro', 'business', 'enterprise'));

-- AI credit balance + monthly usage per workspace
create table if not exists public.workspace_ai_credits (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  monthly_allowance integer not null default 0,
  used_this_period integer not null default 0 check (used_this_period >= 0),
  period_start date not null default (date_trunc('month', now())::date),
  updated_at timestamptz not null default now()
);
alter table public.workspace_ai_credits enable row level security;
drop policy if exists workspace_ai_credits_select on public.workspace_ai_credits;
create policy workspace_ai_credits_select on public.workspace_ai_credits
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists workspace_ai_credits_admin on public.workspace_ai_credits;
create policy workspace_ai_credits_admin on public.workspace_ai_credits
  for all to authenticated using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- Seat usage helper view (optional)
create or replace function public.workspace_seat_count(p_workspace_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.workspace_members where workspace_id = p_workspace_id;
$$;

-- Consume one AI credit (returns false if over limit)
create or replace function public.consume_ai_credit(p_workspace_id uuid, p_cost integer default 1)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  row public.workspace_ai_credits%rowtype;
  sub_plan text;
  allowance integer;
begin
  select plan into sub_plan from public.workspace_subscriptions where workspace_id = p_workspace_id;
  sub_plan := coalesce(sub_plan, 'free');

  allowance := case sub_plan
    when 'free' then 20
    when 'starter' then 100
    when 'pro' then 500
    when 'business' then 2000
    when 'enterprise' then 10000
    else 20
  end;

  insert into public.workspace_ai_credits (workspace_id, balance, monthly_allowance, used_this_period, period_start)
  values (p_workspace_id, allowance, allowance, 0, date_trunc('month', now())::date)
  on conflict (workspace_id) do nothing;

  select * into row from public.workspace_ai_credits where workspace_id = p_workspace_id for update;

  -- Reset period if new month
  if row.period_start < date_trunc('month', now())::date then
    update public.workspace_ai_credits
      set used_this_period = 0,
          balance = allowance,
          monthly_allowance = allowance,
          period_start = date_trunc('month', now())::date,
          updated_at = now()
      where workspace_id = p_workspace_id;
    select * into row from public.workspace_ai_credits where workspace_id = p_workspace_id for update;
  end if;

  if row.used_this_period + p_cost > row.monthly_allowance and row.balance < p_cost then
    return false;
  end if;

  update public.workspace_ai_credits
    set used_this_period = used_this_period + p_cost,
        balance = greatest(0, balance - p_cost),
        updated_at = now()
    where workspace_id = p_workspace_id;

  return true;
end;
$$;

notify pgrst, 'reload schema';
