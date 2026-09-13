-- PULSE Server Usage Enforcement 1.0
-- Enforces metered AI/automation usage and member caps server-side.

create table if not exists public.workspace_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric text not null check (metric in ('ai_analyses', 'automations')),
  actor_id uuid references auth.users(id) on delete set null,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create index if not exists workspace_usage_events_workspace_metric_created_idx
  on public.workspace_usage_events(workspace_id, metric, created_at desc);
create unique index if not exists workspace_usage_events_idempotency_idx
  on public.workspace_usage_events(workspace_id, metric, idempotency_key)
  where idempotency_key is not null;

alter table public.workspace_usage_events enable row level security;
drop policy if exists workspace_usage_events_select_member on public.workspace_usage_events;
create policy workspace_usage_events_select_member on public.workspace_usage_events
  for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.consume_workspace_usage(
  p_workspace_id uuid,
  p_metric text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan text;
  metric_limit integer;
  used_count integer;
  already_recorded boolean := false;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_workspace_member(p_workspace_id) then raise exception 'Not a member of this workspace'; end if;
  if p_metric not in ('ai_analyses', 'automations') then raise exception 'Unsupported usage metric'; end if;

  -- Serialize quota checks per workspace/metric so concurrent requests cannot
  -- both pass the final available slot.
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':' || p_metric, 0));

  if p_idempotency_key is not null then
    select exists(
      select 1 from public.workspace_usage_events
      where workspace_id = p_workspace_id and metric = p_metric and idempotency_key = p_idempotency_key
    ) into already_recorded;
    if already_recorded then
      current_plan := public.workspace_plan(p_workspace_id);
      metric_limit := case when p_metric = 'ai_analyses' then
        case current_plan when 'free' then 20 when 'pro' then 500 when 'business' then 5000 else null end
      else
        case current_plan when 'free' then 0 when 'pro' then 25 when 'business' then 250 else null end
      end;
      select count(*)::integer into used_count from public.workspace_usage_events
        where workspace_id=p_workspace_id and metric=p_metric and created_at >= date_trunc('month', now());
      return jsonb_build_object('allowed', true, 'alreadyRecorded', true, 'used', used_count, 'limit', metric_limit, 'plan', current_plan, 'remaining', case when metric_limit is null then null else greatest(metric_limit-used_count,0) end);
    end if;
  end if;

  current_plan := public.workspace_plan(p_workspace_id);
  metric_limit := case when p_metric = 'ai_analyses' then
    case current_plan when 'free' then 20 when 'pro' then 500 when 'business' then 5000 else null end
  else
    case current_plan when 'free' then 0 when 'pro' then 25 when 'business' then 250 else null end
  end;

  select count(*)::integer into used_count from public.workspace_usage_events
    where workspace_id=p_workspace_id and metric=p_metric and created_at >= date_trunc('month', now());

  if metric_limit is not null and used_count >= metric_limit then
    return jsonb_build_object(
      'allowed', false,
      'used', used_count,
      'limit', metric_limit,
      'plan', current_plan,
      'remaining', 0,
      'reason', initcap(p_metric) || ' limit reached for the ' || initcap(current_plan) || ' plan. Upgrade to continue.'
    );
  end if;

  insert into public.workspace_usage_events(workspace_id, metric, actor_id, idempotency_key)
  values (p_workspace_id, p_metric, auth.uid(), p_idempotency_key);

  used_count := used_count + 1;
  return jsonb_build_object(
    'allowed', true,
    'used', used_count,
    'limit', metric_limit,
    'plan', current_plan,
    'remaining', case when metric_limit is null then null else greatest(metric_limit-used_count,0) end
  );
end;
$$;

grant execute on function public.consume_workspace_usage(uuid, text, text) to authenticated;

create or replace function public.workspace_usage_snapshot(workspace_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_plan text;
  ai_used integer;
  automation_used integer;
  member_count integer;
  discussion_count integer;
  decision_count integer;
  poll_count integer;
  ai_limit integer;
  automation_limit integer;
  member_limit integer;
begin
  if not public.is_workspace_member(workspace_id_input) then raise exception 'Not authorized'; end if;
  current_plan := public.workspace_plan(workspace_id_input);
  select count(*)::integer into member_count from public.workspace_members where workspace_id=workspace_id_input;
  select count(*)::integer into discussion_count from public.topics where workspace_id=workspace_id_input;
  select count(*)::integer into decision_count from public.decisions where workspace_id=workspace_id_input;
  select count(*)::integer into poll_count from public.polls where workspace_id=workspace_id_input;
  select count(*)::integer into ai_used from public.workspace_usage_events where workspace_id=workspace_id_input and metric='ai_analyses' and created_at >= date_trunc('month', now());
  select count(*)::integer into automation_used from public.workspace_usage_events where workspace_id=workspace_id_input and metric='automations' and created_at >= date_trunc('month', now());
  member_limit := case current_plan when 'free' then 5 when 'pro' then 25 when 'business' then 250 else null end;
  ai_limit := case current_plan when 'free' then 20 when 'pro' then 500 when 'business' then 5000 else null end;
  automation_limit := case current_plan when 'free' then 0 when 'pro' then 25 when 'business' then 250 else null end;
  return jsonb_build_object(
    'plan', current_plan,
    'activeMembers', member_count,
    'discussionsCreated', discussion_count,
    'decisionsMade', decision_count,
    'pollsCreated', poll_count,
    'aiAnalysesRun', ai_used,
    'automationsRun', automation_used,
    'memberLimit', member_limit,
    'aiAnalysesLimit', ai_limit,
    'automationsLimit', automation_limit,
    'periodStart', date_trunc('month', now())
  );
end;
$$;

grant execute on function public.workspace_usage_snapshot(uuid) to authenticated;

create or replace function public.enforce_workspace_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan text;
  member_limit integer;
  member_count integer;
begin
  current_plan := public.workspace_plan(new.workspace_id);
  member_limit := case current_plan when 'free' then 5 when 'pro' then 25 when 'business' then 250 else null end;
  if member_limit is null then return new; end if;
  select count(*)::integer into member_count from public.workspace_members where workspace_id=new.workspace_id;
  if member_count >= member_limit then
    raise exception 'Member limit reached for the % plan. Upgrade to add more team members.', initcap(current_plan);
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_workspace_member_limit on public.workspace_members;
create trigger enforce_workspace_member_limit
before insert on public.workspace_members
for each row execute procedure public.enforce_workspace_member_limit();

-- Automation runs now consume one metered automation unit per invocation.
create or replace function public.run_workspace_automations(target_workspace uuid)
returns table(processed integer, notifications integer)
language plpgsql security definer set search_path = public as $$
declare
  r record; a record; p integer := 0; n integer := 0; already boolean; quota jsonb;
begin
  if not public.is_workspace_member(target_workspace) then raise exception 'Not authorized'; end if;
  select public.consume_workspace_usage(target_workspace, 'automations', null) into quota;
  if coalesce((quota->>'allowed')::boolean, false) = false then
    raise exception '%', coalesce(quota->>'reason', 'Automation usage limit reached for this workspace.');
  end if;
  perform public.seed_automation_rules(target_workspace);
  for r in select * from public.automation_rules where workspace_id=target_workspace and enabled loop
    for a in
      select ac.id, ac.title, ac.owner_id, ac.deadline, ac.priority
      from public.actions ac
      where ac.workspace_id=target_workspace and ac.status <> 'done' and ac.owner_id is not null
        and ((r.trigger='action_overdue' and ac.deadline < now())
          or (r.trigger='high_priority_overdue' and ac.priority='high' and ac.deadline < now())
          or (r.trigger='action_due_soon' and ac.deadline >= now() and ac.deadline <= now()+interval '48 hours'))
    loop
      p := p + 1;
      select exists(select 1 from public.notifications x where x.user_id=a.owner_id and x.type='automation:'||r.trigger and x.body like '%'||a.id::text||'%' and x.created_at > now()-interval '24 hours') into already;
      if not already then
        insert into public.notifications(user_id,type,title,body) values (a.owner_id,'automation:'||r.trigger,r.name, a.title||' ['||a.id::text||']');
        n := n + 1;
      end if;
    end loop;
    insert into public.automation_runs(workspace_id,rule_id,action_count) values(target_workspace,r.id,p);
  end loop;
  return query select p,n;
end; $$;

grant execute on function public.run_workspace_automations(uuid) to authenticated;

notify pgrst, 'reload schema';
