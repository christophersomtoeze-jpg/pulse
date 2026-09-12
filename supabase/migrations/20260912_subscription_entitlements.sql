-- PULSE Subscription Entitlements 1.0
-- Central source of truth for plan feature access. Client UI gates are only a UX
-- layer; server-side functions should use this RPC before performing metered work.

create or replace function public.workspace_plan(workspace_id_input uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select plan from public.workspace_subscriptions where workspace_id = workspace_id_input and status in ('active','past_due')),
    'free'
  );
$$;

grant execute on function public.workspace_plan(uuid) to authenticated;


create or replace function public.workspace_plan_allows(workspace_id_input uuid, feature_input text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_plan text := public.workspace_plan(workspace_id_input);
  required_plan integer;
  current_rank integer;
begin
  if not public.is_workspace_member(workspace_id_input) then return false; end if;
  required_plan := case feature_input
    when 'decision-intelligence' then 1
    when 'analytics' then 1
    when 'risk-center' then 1
    when 'memory' then 1
    when 'automation' then 1
    when 'integrations' then 1
    when 'meeting-summaries' then 1
    when 'audit-log' then 2
    when 'api-keys' then 2
    when 'sso' then 2
    else 0
  end;
  current_rank := case current_plan when 'free' then 0 when 'pro' then 1 when 'business' then 2 when 'enterprise' then 3 else 0 end;
  return current_rank >= required_plan;
end;
$$;

grant execute on function public.workspace_plan_allows(uuid, text) to authenticated;
notify pgrst, 'reload schema';
