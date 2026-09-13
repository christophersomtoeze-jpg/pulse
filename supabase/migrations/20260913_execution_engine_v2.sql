-- PULSE Execution Engine v2: action dependencies + execution graph
create table if not exists public.action_dependencies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action_id uuid not null references public.actions(id) on delete cascade,
  depends_on_action_id uuid not null references public.actions(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint action_dependencies_unique unique (action_id, depends_on_action_id),
  constraint action_dependencies_not_self check (action_id <> depends_on_action_id)
);
create index if not exists action_dependencies_workspace_idx on public.action_dependencies(workspace_id);
create index if not exists action_dependencies_action_idx on public.action_dependencies(action_id);
create index if not exists action_dependencies_blocker_idx on public.action_dependencies(depends_on_action_id);

create or replace function public.validate_action_dependency_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.actions a where a.id = new.action_id and a.workspace_id = new.workspace_id) then
    raise exception 'Action does not belong to dependency workspace';
  end if;
  if not exists (select 1 from public.actions a where a.id = new.depends_on_action_id and a.workspace_id = new.workspace_id) then
    raise exception 'Dependency action does not belong to dependency workspace';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_action_dependency_workspace on public.action_dependencies;
create trigger validate_action_dependency_workspace before insert or update on public.action_dependencies
for each row execute function public.validate_action_dependency_workspace();

alter table public.action_dependencies enable row level security;
drop policy if exists action_dependencies_select_member on public.action_dependencies;
create policy action_dependencies_select_member on public.action_dependencies for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists action_dependencies_insert_member on public.action_dependencies;
create policy action_dependencies_insert_member on public.action_dependencies for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
drop policy if exists action_dependencies_delete_member on public.action_dependencies;
create policy action_dependencies_delete_member on public.action_dependencies for delete to authenticated using (public.is_workspace_member(workspace_id));

do $$ begin
  alter publication supabase_realtime add table public.action_dependencies;
exception when duplicate_object then null; end $$;
