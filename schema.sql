-- PULSE production database schema
-- Run this once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'member', 'guest');
create type public.discussion_status as enum ('active', 'heating', 'settling', 'archived');
create type public.decision_status as enum ('decided', 'in-review', 'revisiting');
create type public.poll_status as enum ('draft', 'open', 'closed');
create type public.intent_wave as enum ('whisper', 'standard', 'pulse');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'PULSE Member',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  summary text,
  status public.discussion_status not null default 'active',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  intent public.intent_wave not null default 'standard',
  created_at timestamptz not null default now()
);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discussion_id uuid references public.discussions(id) on delete set null,
  title text not null,
  summary text,
  status public.decision_status not null default 'in-review',
  pinned boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discussion_id uuid references public.discussions(id) on delete set null,
  question text not null,
  status public.poll_status not null default 'open',
  closes_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null,
  position integer not null default 0
);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists discussions_workspace_updated_idx on public.discussions(workspace_id, updated_at desc);
create index if not exists messages_discussion_created_idx on public.messages(discussion_id, created_at);
create index if not exists decisions_workspace_updated_idx on public.decisions(workspace_id, updated_at desc);
create index if not exists polls_workspace_status_idx on public.polls(workspace_id, status);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'PULSE Member')) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_workspace_member(target_workspace uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.workspace_members where workspace_id = target_workspace and user_id = auth.uid());
$$;

create or replace function public.is_workspace_admin(target_workspace uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.workspace_members where workspace_id = target_workspace and user_id = auth.uid() and role in ('owner','admin'));
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.discussions enable row level security;
alter table public.messages enable row level security;
alter table public.decisions enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.resources enable row level security;
alter table public.notifications enable row level security;

-- Profiles: authenticated users may see basic member identity inside the app; users update only themselves.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Workspace access.
drop policy if exists workspace_select_member on public.workspaces;
create policy workspace_select_member on public.workspaces for select to authenticated using (public.is_workspace_member(id));
drop policy if exists workspace_insert_authenticated on public.workspaces;
create policy workspace_insert_authenticated on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists workspace_update_admin on public.workspaces;
create policy workspace_update_admin on public.workspaces for update to authenticated using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

drop policy if exists members_select_member on public.workspace_members;
create policy members_select_member on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists members_insert_admin on public.workspace_members;
create policy members_insert_admin on public.workspace_members for insert to authenticated with check (public.is_workspace_admin(workspace_id) or exists(select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));
drop policy if exists members_update_admin on public.workspace_members;
create policy members_update_admin on public.workspace_members for update to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop policy if exists members_delete_admin on public.workspace_members;
create policy members_delete_admin on public.workspace_members for delete to authenticated using (public.is_workspace_admin(workspace_id));

-- Discussions.
drop policy if exists discussions_select_member on public.discussions;
create policy discussions_select_member on public.discussions for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists discussions_insert_member on public.discussions;
create policy discussions_insert_member on public.discussions for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
drop policy if exists discussions_update_member on public.discussions;
create policy discussions_update_member on public.discussions for update to authenticated using (public.is_workspace_member(workspace_id));

-- Messages are accessible only through discussions in a member workspace.
drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages for select to authenticated using (exists(select 1 from public.discussions d where d.id = discussion_id and public.is_workspace_member(d.workspace_id)));
drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert to authenticated with check (author_id = auth.uid() and exists(select 1 from public.discussions d where d.id = discussion_id and public.is_workspace_member(d.workspace_id)));

-- Decisions.
drop policy if exists decisions_select_member on public.decisions;
create policy decisions_select_member on public.decisions for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists decisions_insert_member on public.decisions;
create policy decisions_insert_member on public.decisions for insert to authenticated with check (created_by = auth.uid() and public.is_workspace_member(workspace_id));
drop policy if exists decisions_update_member on public.decisions;
create policy decisions_update_member on public.decisions for update to authenticated using (public.is_workspace_member(workspace_id));

-- Polls/options/votes.
drop policy if exists polls_select_member on public.polls;
create policy polls_select_member on public.polls for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists polls_insert_member on public.polls;
create policy polls_insert_member on public.polls for insert to authenticated with check (created_by = auth.uid() and public.is_workspace_member(workspace_id));
drop policy if exists poll_options_select_member on public.poll_options;
create policy poll_options_select_member on public.poll_options for select to authenticated using (exists(select 1 from public.polls p where p.id = poll_id and public.is_workspace_member(p.workspace_id)));
drop policy if exists poll_options_insert_member on public.poll_options;
create policy poll_options_insert_member on public.poll_options for insert to authenticated with check (exists(select 1 from public.polls p where p.id = poll_id and public.is_workspace_member(p.workspace_id)));
drop policy if exists poll_votes_select_member on public.poll_votes;
create policy poll_votes_select_member on public.poll_votes for select to authenticated using (exists(select 1 from public.polls p where p.id = poll_id and public.is_workspace_member(p.workspace_id)));
drop policy if exists poll_votes_insert_self on public.poll_votes;
create policy poll_votes_insert_self on public.poll_votes for insert to authenticated with check (user_id = auth.uid() and exists(select 1 from public.polls p where p.id = poll_id and public.is_workspace_member(p.workspace_id)));

-- Resources and notifications.
drop policy if exists resources_select_member on public.resources;
create policy resources_select_member on public.resources for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists resources_insert_member on public.resources;
create policy resources_insert_member on public.resources for insert to authenticated with check (uploaded_by = auth.uid() and public.is_workspace_member(workspace_id));
drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Realtime publication for collaboration.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.discussions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
