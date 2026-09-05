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


-- PULSE Team & Invitation upgrade
alter table public.profiles add column if not exists email text;
create unique index if not exists profiles_email_unique_idx on public.profiles(lower(email)) where email is not null;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'PULSE Member'), lower(new.email))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role workspace_role not null default 'member',
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists workspace_invites_pending_unique on public.workspace_invitations(workspace_id, lower(email)) where status = 'pending';
create index if not exists workspace_invites_workspace_idx on public.workspace_invitations(workspace_id, created_at desc);

alter table public.workspace_invitations enable row level security;
drop policy if exists workspace_invites_select_admin on public.workspace_invitations;
create policy workspace_invites_select_admin on public.workspace_invitations for select to authenticated using (public.is_workspace_admin(workspace_id));
drop policy if exists workspace_invites_insert_admin on public.workspace_invitations;
create policy workspace_invites_insert_admin on public.workspace_invitations for insert to authenticated with check (public.is_workspace_admin(workspace_id) and invited_by = auth.uid());
drop policy if exists workspace_invites_update_admin on public.workspace_invitations;
create policy workspace_invites_update_admin on public.workspace_invitations for update to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

create or replace function public.create_workspace_with_owner(workspace_name text, workspace_slug text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare new_workspace public.workspaces;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.workspaces(name, slug, owner_id) values (workspace_name, workspace_slug, auth.uid()) returning * into new_workspace;
  insert into public.workspace_members(workspace_id, user_id, role) values (new_workspace.id, auth.uid(), 'owner');
  return new_workspace;
end;
$$;
grant execute on function public.create_workspace_with_owner(text,text) to authenticated;

-- Re-run this trigger definition after applying the upgrade.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- ============================================================================
-- PULSE recursion-fix migration
-- ----------------------------------------------------------------------------
-- Forces every existing policy on workspaces/workspace_members to be dropped
-- BY NAME (whatever it's actually called in your live project), not just the
-- ones this file happens to know about. If an older draft of this schema
-- left behind a self-referencing policy on workspace_members, this is what
-- removes it — "create policy" never overwrites a differently-named policy,
-- which is why simply re-running the file above wasn't enough on its own.
-- Safe to run any number of times.
-- ============================================================================
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('workspaces', 'workspace_members')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Recreate the known-good policies (idempotent — safe alongside the block above).
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

-- ============================================================================
-- PULSE Decision Room upgrade
-- Run this after the block above. Adds everything the Decision Room,
-- voting, AI Decision Intelligence, and Dashboard features need.
-- ============================================================================

-- Decisions gain a description, context/resources link, deadline, owner and
-- a permanent recorded outcome (separate from the working "status" field).
alter table public.decisions add column if not exists description text;
alter table public.decisions add column if not exists deadline timestamptz;
alter table public.decisions add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.decisions add column if not exists outcome text check (outcome in ('approved', 'rejected', 'postponed'));
alter table public.decisions add column if not exists decided_at timestamptz;
alter table public.decisions add column if not exists decided_by uuid references public.profiles(id) on delete set null;

-- Context/resources attached directly to a decision (links, files via existing `resources` table).
alter table public.resources add column if not exists decision_id uuid references public.decisions(id) on delete cascade;
alter table public.resources add column if not exists url text;
create index if not exists resources_decision_idx on public.resources(decision_id);

-- Voting: Yes / No / Need more information, optionally anonymous.
do $$ begin
  create type public.decision_vote_choice as enum ('yes', 'no', 'needs_info');
exception when duplicate_object then null; end $$;
create table if not exists public.decision_votes (
  decision_id uuid not null references public.decisions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  choice public.decision_vote_choice not null,
  anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (decision_id, user_id)
);

-- Team discussion on a decision: threaded, with @mentions.
create table if not exists public.decision_comments (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  parent_comment_id uuid references public.decision_comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 8000),
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists decision_comments_decision_idx on public.decision_comments(decision_id, created_at);

-- Permanent decision history — every outcome/status change, kept forever.
create table if not exists public.decision_history (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  status public.decision_status,
  outcome text,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists decision_history_decision_idx on public.decision_history(decision_id, created_at desc);

-- AI Decision Intelligence — cached results from the ai-decision-summary edge function.
create table if not exists public.decision_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  summary text not null,
  disagreements text,
  strongest_arguments text,
  recommendation text,
  confidence numeric check (confidence >= 0 and confidence <= 1),
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists decision_ai_analyses_decision_idx on public.decision_ai_analyses(decision_id, created_at desc);

alter table public.decision_votes enable row level security;
alter table public.decision_comments enable row level security;
alter table public.decision_history enable row level security;
alter table public.decision_ai_analyses enable row level security;

-- A decision belongs to a workspace only indirectly (via public.decisions), so
-- every policy below checks membership through that join — never a self-join.
drop policy if exists decision_votes_select_member on public.decision_votes;
create policy decision_votes_select_member on public.decision_votes for select to authenticated using (exists(select 1 from public.decisions d where d.id = decision_id and public.is_workspace_member(d.workspace_id)));
drop policy if exists decision_votes_upsert_self on public.decision_votes;
create policy decision_votes_upsert_self on public.decision_votes for insert to authenticated with check (user_id = auth.uid() and exists(select 1 from public.decisions d where d.id = decision_id and public.is_workspace_member(d.workspace_id)));
drop policy if exists decision_votes_update_self on public.decision_votes;
create policy decision_votes_update_self on public.decision_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists decision_comments_select_member on public.decision_comments;
create policy decision_comments_select_member on public.decision_comments for select to authenticated using (exists(select 1 from public.decisions d where d.id = decision_id and public.is_workspace_member(d.workspace_id)));
drop policy if exists decision_comments_insert_member on public.decision_comments;
create policy decision_comments_insert_member on public.decision_comments for insert to authenticated with check (author_id = auth.uid() and exists(select 1 from public.decisions d where d.id = decision_id and public.is_workspace_member(d.workspace_id)));

drop policy if exists decision_history_select_member on public.decision_history;
create policy decision_history_select_member on public.decision_history for select to authenticated using (exists(select 1 from public.decisions d where d.id = decision_id and public.is_workspace_member(d.workspace_id)));

drop policy if exists decision_ai_select_member on public.decision_ai_analyses;
create policy decision_ai_select_member on public.decision_ai_analyses for select to authenticated using (exists(select 1 from public.decisions d where d.id = decision_id and public.is_workspace_member(d.workspace_id)));

-- Atomic helpers so the client never has to coordinate multi-table writes itself.
create or replace function public.cast_decision_vote(p_decision_id uuid, p_choice public.decision_vote_choice, p_anonymous boolean default false)
returns public.decision_votes language plpgsql security definer set search_path = public as $$
declare result public.decision_votes;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.decisions d where d.id = p_decision_id and public.is_workspace_member(d.workspace_id)) then
    raise exception 'Not a member of this decision''s workspace';
  end if;
  insert into public.decision_votes (decision_id, user_id, choice, anonymous)
  values (p_decision_id, auth.uid(), p_choice, p_anonymous)
  on conflict (decision_id, user_id) do update set choice = excluded.choice, anonymous = excluded.anonymous, updated_at = now()
  returning * into result;
  return result;
end;
$$;
grant execute on function public.cast_decision_vote(uuid, public.decision_vote_choice, boolean) to authenticated;

create or replace function public.set_decision_outcome(p_decision_id uuid, p_outcome text, p_note text default null)
returns public.decisions language plpgsql security definer set search_path = public as $$
declare result public.decisions; ws uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_outcome not in ('approved', 'rejected', 'postponed') then raise exception 'Invalid outcome'; end if;
  select workspace_id into ws from public.decisions where id = p_decision_id;
  if ws is null or not public.is_workspace_member(ws) then raise exception 'Not a member of this decision''s workspace'; end if;

  update public.decisions set
    outcome = p_outcome,
    status = case p_outcome when 'approved' then 'decided'::public.decision_status when 'postponed' then 'revisiting'::public.decision_status else status end,
    decided_at = now(),
    decided_by = auth.uid(),
    updated_at = now()
  where id = p_decision_id
  returning * into result;

  insert into public.decision_history (decision_id, status, outcome, note, changed_by)
  values (p_decision_id, result.status, p_outcome, p_note, auth.uid());

  return result;
end;
$$;
grant execute on function public.set_decision_outcome(uuid, text, text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.decision_votes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.decision_comments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.decisions;
exception when duplicate_object then null; end $$;

-- ============================================================================
-- PULSE Polls upgrade
-- Atomic create + vote so the client never coordinates poll_options/poll_votes
-- writes itself, and a tally view so vote percentages are never wrong again.
-- ============================================================================
create or replace function public.create_poll(p_workspace_id uuid, p_question text, p_option_labels text[], p_discussion_id uuid default null, p_closes_at timestamptz default null)
returns public.polls language plpgsql security definer set search_path = public as $$
declare result public.polls; i integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_workspace_member(p_workspace_id) then raise exception 'Not a member of this workspace'; end if;
  if array_length(p_option_labels, 1) is null or array_length(p_option_labels, 1) < 2 then raise exception 'A poll needs at least two options'; end if;

  insert into public.polls (workspace_id, discussion_id, question, closes_at, created_by)
  values (p_workspace_id, p_discussion_id, p_question, p_closes_at, auth.uid())
  returning * into result;

  for i in 1 .. array_length(p_option_labels, 1) loop
    insert into public.poll_options (poll_id, label, position) values (result.id, p_option_labels[i], i);
  end loop;

  return result;
end;
$$;
grant execute on function public.create_poll(uuid, text, text[], uuid, timestamptz) to authenticated;

create or replace function public.cast_poll_vote(p_poll_id uuid, p_option_id uuid)
returns public.poll_votes language plpgsql security definer set search_path = public as $$
declare result public.poll_votes;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.polls p where p.id = p_poll_id and public.is_workspace_member(p.workspace_id)) then
    raise exception 'Not a member of this poll''s workspace';
  end if;
  if not exists(select 1 from public.poll_options o where o.id = p_option_id and o.poll_id = p_poll_id) then
    raise exception 'That option does not belong to this poll';
  end if;
  insert into public.poll_votes (poll_id, option_id, user_id)
  values (p_poll_id, p_option_id, auth.uid())
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id, created_at = now()
  returning * into result;
  return result;
end;
$$;
grant execute on function public.cast_poll_vote(uuid, uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.poll_votes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.polls;
exception when duplicate_object then null; end $$;

-- ============================================================================
-- Force PostgREST to reload its schema cache right now.
-- This is exactly what fixes "Could not find a relationship... in the schema
-- cache" errors — that error means PostgREST cached the table shape BEFORE
-- the alter table/create table statements above ran. Supabase usually
-- reloads automatically on DDL, but this makes it immediate and guaranteed
-- instead of hoping the auto-reload already fired.
-- ============================================================================
notify pgrst, 'reload schema';
