-- PULSE production database schema
-- Run this once in Supabase SQL Editor.
create extension if not exists pgcrypto;

do $$ begin
  create type public.workspace_role as enum ('owner', 'admin', 'member', 'guest');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.discussion_status as enum ('active', 'heating', 'settling', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.decision_status as enum ('decided', 'in-review', 'revisiting');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.poll_status as enum ('draft', 'open', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.intent_wave as enum ('whisper', 'standard', 'pulse');
exception when duplicate_object then null;
end $$;

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

-- ============================================================================
-- PULSE Phase 3 — Knowledge: Actions/Tasks
-- ============================================================================
do $$ begin
  create type public.action_status as enum ('todo', 'in-progress', 'done');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.action_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  decision_id uuid references public.decisions(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 300),
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  deadline timestamptz,
  status public.action_status not null default 'todo',
  priority public.action_priority not null default 'medium',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists actions_workspace_idx on public.actions(workspace_id, status);
create index if not exists actions_owner_idx on public.actions(owner_id, status);

alter table public.actions enable row level security;
drop policy if exists actions_select_member on public.actions;
create policy actions_select_member on public.actions for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists actions_insert_member on public.actions;
create policy actions_insert_member on public.actions for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
drop policy if exists actions_update_member on public.actions;
create policy actions_update_member on public.actions for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists actions_delete_owner on public.actions;
create policy actions_delete_owner on public.actions for delete to authenticated using (public.is_workspace_admin(workspace_id) or created_by = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.actions;
exception when duplicate_object then null; end $$;

-- ============================================================================
-- PULSE Phase 4 — AI: standalone assistant + meeting summaries
-- ============================================================================
create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists assistant_messages_user_idx on public.assistant_messages(workspace_id, user_id, created_at);

alter table public.assistant_messages enable row level security;
drop policy if exists assistant_messages_select_own on public.assistant_messages;
create policy assistant_messages_select_own on public.assistant_messages for select to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id));
drop policy if exists assistant_messages_insert_own on public.assistant_messages;
create policy assistant_messages_insert_own on public.assistant_messages for insert to authenticated with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create table if not exists public.meeting_summaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  raw_notes text not null,
  summary text,
  key_points text,
  action_items text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists meeting_summaries_workspace_idx on public.meeting_summaries(workspace_id, created_at desc);

alter table public.meeting_summaries enable row level security;
drop policy if exists meeting_summaries_select_member on public.meeting_summaries;
create policy meeting_summaries_select_member on public.meeting_summaries for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists meeting_summaries_insert_member on public.meeting_summaries;
create policy meeting_summaries_insert_member on public.meeting_summaries for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.meeting_summaries;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.assistant_messages;
exception when duplicate_object then null; end $$;

-- ============================================================================
-- PULSE Phase 5 — Business: audit log, analytics support, billing scaffold
-- ============================================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_workspace_idx on public.audit_log(workspace_id, created_at desc);

alter table public.audit_log enable row level security;
drop policy if exists audit_log_select_member on public.audit_log;
create policy audit_log_select_member on public.audit_log for select to authenticated using (public.is_workspace_member(workspace_id));
-- Inserts only ever happen via SECURITY DEFINER triggers/functions below — no direct client insert policy on purpose.

create or replace function public.log_workspace_member_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (workspace_id, actor_id, action, detail)
    values (new.workspace_id, auth.uid(), 'member_added', format('Added a %s', new.role));
  elsif tg_op = 'UPDATE' and old.role is distinct from new.role then
    insert into public.audit_log (workspace_id, actor_id, action, detail)
    values (new.workspace_id, auth.uid(), 'member_role_changed', format('Role changed from %s to %s', old.role, new.role));
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (workspace_id, actor_id, action, detail)
    values (old.workspace_id, auth.uid(), 'member_removed', 'Member removed from workspace');
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists on_workspace_member_change on public.workspace_members;
create trigger on_workspace_member_change after insert or update or delete on public.workspace_members for each row execute procedure public.log_workspace_member_change();

create or replace function public.log_decision_outcome() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.outcome is distinct from old.outcome and new.outcome is not null then
    insert into public.audit_log (workspace_id, actor_id, action, detail)
    values (new.workspace_id, auth.uid(), 'decision_' || new.outcome, format('Decision "%s" marked %s', new.title, new.outcome));
  end if;
  return new;
end;
$$;
drop trigger if exists on_decision_outcome_change on public.decisions;
create trigger on_decision_outcome_change after update on public.decisions for each row execute procedure public.log_decision_outcome();

create or replace function public.log_invitation_sent() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (workspace_id, actor_id, action, detail)
  values (new.workspace_id, auth.uid(), 'invitation_sent', format('Invited %s as %s', new.email, new.role));
  return new;
end;
$$;
drop trigger if exists on_invitation_sent on public.workspace_invitations;
create trigger on_invitation_sent after insert on public.workspace_invitations for each row execute procedure public.log_invitation_sent();

-- Billing scaffold — inert until you connect a real Stripe account (see SUPABASE_SETUP.md).
create table if not exists public.workspace_subscriptions (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.workspace_subscriptions enable row level security;
drop policy if exists workspace_subscriptions_select_member on public.workspace_subscriptions;
create policy workspace_subscriptions_select_member on public.workspace_subscriptions for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists workspace_subscriptions_admin_all on public.workspace_subscriptions;
create policy workspace_subscriptions_admin_all on public.workspace_subscriptions for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

-- ============================================================================
-- PULSE Phase 6 — Integrations framework (Slack fully wired; others scaffolded)
-- ============================================================================
create table if not exists public.workspace_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('slack', 'teams', 'google', 'microsoft365', 'jira', 'notion')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected')),
  external_team_id text,
  access_token text,
  metadata jsonb not null default '{}'::jsonb,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider)
);
alter table public.workspace_integrations enable row level security;
drop policy if exists workspace_integrations_select_member on public.workspace_integrations;
create policy workspace_integrations_select_member on public.workspace_integrations for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists workspace_integrations_admin_all on public.workspace_integrations;
create policy workspace_integrations_admin_all on public.workspace_integrations for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
-- NOTE: access_token is stored in plaintext here for simplicity. Before going to
-- production with real integrations, move this column to use Supabase Vault
-- (pgsodium) so tokens are encrypted at rest — see SUPABASE_SETUP.md.

notify pgrst, 'reload schema';

-- ============================================================================
-- PULSE composer upgrade — image/voice attachments on messages
-- ============================================================================
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists attachment_type text check (attachment_type in ('image', 'audio'));

-- Storage bucket for uploaded images/voice notes. Inserting into
-- storage.buckets genuinely creates it (public read, so uploaded media
-- loads directly via URL) — no manual Dashboard step needed.
insert into storage.buckets (id, name, public)
values ('pulse-media', 'pulse-media', true)
on conflict (id) do nothing;

drop policy if exists pulse_media_read_public on storage.objects;
create policy pulse_media_read_public on storage.objects for select using (bucket_id = 'pulse-media');
drop policy if exists pulse_media_insert_authenticated on storage.objects;
create policy pulse_media_insert_authenticated on storage.objects for insert to authenticated with check (bucket_id = 'pulse-media');
drop policy if exists pulse_media_delete_own on storage.objects;
create policy pulse_media_delete_own on storage.objects for delete to authenticated using (bucket_id = 'pulse-media' and owner = auth.uid());

notify pgrst, 'reload schema';

-- ============================================================================
-- Founder traction metrics — real usage data across the whole platform,
-- visible only to you (added manually below), never to workspace members.
-- ============================================================================
create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- No select policy for regular users at all — only the service role (or a
-- SECURITY DEFINER function, below) can ever read this table.

create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.platform_admins where user_id = auth.uid());
$$;

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists product_events_name_idx on public.product_events(event_name, created_at desc);
alter table public.product_events enable row level security;
drop policy if exists product_events_select_platform_admin on public.product_events;
create policy product_events_select_platform_admin on public.product_events for select to authenticated using (public.is_platform_admin());
-- No insert policy for the client — every event below is logged by a
-- SECURITY DEFINER function or trigger, never by a direct client write.

create or replace function public.log_product_event(p_event_name text, p_workspace_id uuid default null, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.product_events (event_name, workspace_id, user_id, metadata)
  values (p_event_name, p_workspace_id, auth.uid(), p_metadata);
end;
$$;
grant execute on function public.log_product_event(text, uuid, jsonb) to authenticated;

-- Log signup automatically — extends the existing handle_new_user trigger.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'PULSE Member'), lower(new.email))
  on conflict (id) do update set email = excluded.email;
  insert into public.product_events (event_name, user_id) values ('user_signed_up', new.id);
  return new;
end;
$$;

-- One aggregated RPC so the client never needs row-level access to product_events.
create or replace function public.get_platform_metrics()
returns table (
  total_workspaces bigint, total_users bigint, decisions_created_7d bigint, decisions_created_30d bigint,
  votes_cast_7d bigint, discussions_created_7d bigint, weekly_active_users bigint
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  return query select
    (select count(*) from public.workspaces),
    (select count(*) from public.profiles),
    (select count(*) from public.decisions where created_at >= now() - interval '7 days'),
    (select count(*) from public.decisions where created_at >= now() - interval '30 days'),
    (select count(*) from public.decision_votes where created_at >= now() - interval '7 days'),
    (select count(*) from public.discussions where created_at >= now() - interval '7 days'),
    (select count(distinct user_id) from public.product_events where created_at >= now() - interval '7 days' and user_id is not null);
end;
$$;
grant execute on function public.get_platform_metrics() to authenticated;

-- ============================================================================
-- Onboarding — every new workspace gets real seeded content, never a blank canvas.
-- ============================================================================
create or replace function public.create_workspace_with_owner(workspace_name text, workspace_slug text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare new_workspace public.workspaces; welcome_discussion_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.workspaces(name, slug, owner_id) values (workspace_name, workspace_slug, auth.uid()) returning * into new_workspace;
  insert into public.workspace_members(workspace_id, user_id, role) values (new_workspace.id, auth.uid(), 'owner');

  insert into public.discussions (workspace_id, title, summary, status, created_by)
  values (new_workspace.id, 'Welcome to PULSE', 'A quick tour of how your team will think, decide, and move together.', 'active', auth.uid())
  returning id into welcome_discussion_id;

  insert into public.messages (discussion_id, author_id, body)
  values (welcome_discussion_id, auth.uid(),
    E'Welcome to ' || workspace_name || E'! Here''s the flow:\n1. Discuss something in a topic like this one.\n2. When it''s time to decide, turn it into a Decision — vote, discuss, and get an AI summary.\n3. Approve it and PULSE keeps the record forever, with any follow-up Actions attached.\n\nInvite your team from the sidebar to get started for real.');

  insert into public.decisions (workspace_id, discussion_id, title, description, status, owner_id, created_by)
  values (new_workspace.id, welcome_discussion_id, 'Sample decision: pick a name for our next project', 'This is a sample — vote on it, try the AI analysis, then create your own real decision.', 'in-review', auth.uid(), auth.uid());

  perform public.log_product_event('workspace_created', new_workspace.id, jsonb_build_object('name', workspace_name));

  return new_workspace;
end;
$$;
grant execute on function public.create_workspace_with_owner(text,text) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- Settings upgrade: Account fields, email sync, login history, notification
-- preferences, workspace general settings, AI toggle, account deletion support
-- ============================================================================

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists bio text;

-- Keep profiles.email in sync when someone changes their auth email (the
-- existing handle_new_user trigger only fires on INSERT, not email changes).
create or replace function public.handle_user_email_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email), updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated after update of email on auth.users for each row execute procedure public.handle_user_email_change();

-- Login history — real, minimal (timestamp + user agent), logged by the client
-- right after a successful sign-in. Supabase's public API doesn't expose a
-- cross-device "active sessions" list, so this is the honest substitute.
create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists login_history_user_idx on public.login_history(user_id, created_at desc);
alter table public.login_history enable row level security;
drop policy if exists login_history_select_own on public.login_history;
create policy login_history_select_own on public.login_history for select to authenticated using (user_id = auth.uid());
drop policy if exists login_history_insert_own on public.login_history;
create policy login_history_insert_own on public.login_history for insert to authenticated with check (user_id = auth.uid());

-- Workspace general settings.
alter table public.workspaces add column if not exists description text;
alter table public.workspaces add column if not exists ai_enabled boolean not null default true;
alter table public.workspaces add column if not exists default_language text not null default 'en';
alter table public.workspaces add column if not exists timezone text not null default 'UTC';

-- Notification preferences — one row per user (applies across all their workspaces for now).
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  notify_mentions boolean not null default true,
  notify_decisions boolean not null default true,
  notify_actions boolean not null default true,
  notify_invitations boolean not null default true,
  digest_frequency text not null default 'weekly' check (digest_frequency in ('daily', 'weekly', 'off')),
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences for select to authenticated using (user_id = auth.uid());
drop policy if exists notification_preferences_upsert_own on public.notification_preferences;
create policy notification_preferences_upsert_own on public.notification_preferences for insert to authenticated with check (user_id = auth.uid());
drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Used by the send-notification-email edge function to look up who to email
-- and whether they actually want that category of email — SECURITY DEFINER
-- because the function runs with the recipient's identity, not the sender's.
create or replace function public.get_notification_target(p_user_id uuid, p_category text)
returns table (email text, full_name text) language plpgsql security definer set search_path = public as $$
declare wants_it boolean;
begin
  select
    case p_category
      when 'mentions' then coalesce(np.notify_mentions, true)
      when 'decisions' then coalesce(np.notify_decisions, true)
      when 'actions' then coalesce(np.notify_actions, true)
      when 'invitations' then coalesce(np.notify_invitations, true)
      else true
    end and coalesce(np.email_enabled, true)
  into wants_it
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id
  where p.id = p_user_id;

  if wants_it is not false then
    return query select p.email, p.full_name from public.profiles p where p.id = p_user_id;
  end if;
  return;
end;
$$;
grant execute on function public.get_notification_target(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- Daily/weekly digest emails via pg_cron. If this errors with "extension
-- pg_cron does not exist", enable it first in Supabase Dashboard > Database >
-- Extensions (search "pg_cron", toggle on), then re-run this block.
-- ============================================================================
create extension if not exists pg_cron with schema extensions;

-- Requires the project URL + service-role key so pg_cron can call the edge
-- function directly over HTTP via pg_net (also needs enabling the same way).
create extension if not exists pg_net with schema extensions;

-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> before running this select,
-- or just skip it — digests simply won't send until this is scheduled.
-- select cron.schedule(
--   'pulse-daily-digest', '0 13 * * *',
--   $$ select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-digest-emails',
--     headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
--     body := '{"frequency": "daily"}'::jsonb
--   ); $$
-- );
-- select cron.schedule(
--   'pulse-weekly-digest', '0 13 * * 1',
--   $$ select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-digest-emails',
--     headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
--     body := '{"frequency": "weekly"}'::jsonb
--   ); $$
-- );

notify pgrst, 'reload schema';

-- Workspace deletion — owner only. Every child table already has "on delete
-- cascade" back to workspaces, so this one delete removes everything real:
-- discussions, decisions, actions, polls, resources, integrations, etc.
drop policy if exists workspace_delete_owner on public.workspaces;
create policy workspace_delete_owner on public.workspaces for delete to authenticated using (owner_id = auth.uid());

notify pgrst, 'reload schema';

-- ============================================================================
-- Web Push notifications — real browser push, no mobile app needed.
-- ============================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

alter table public.notification_preferences add column if not exists push_enabled boolean not null default true;

-- Lets the send-push-notification edge function (service role) look up a
-- user's subscriptions + whether they actually want this category, mirroring
-- get_notification_target's email logic.
create or replace function public.get_push_targets(p_user_id uuid, p_category text)
returns table (endpoint text, p256dh text, auth text) language plpgsql security definer set search_path = public as $$
declare wants_it boolean;
begin
  select
    case p_category
      when 'mentions' then coalesce(np.notify_mentions, true)
      when 'decisions' then coalesce(np.notify_decisions, true)
      when 'actions' then coalesce(np.notify_actions, true)
      when 'invitations' then coalesce(np.notify_invitations, true)
      else true
    end and coalesce(np.push_enabled, true)
  into wants_it
  from public.profiles p left join public.notification_preferences np on np.user_id = p.id
  where p.id = p_user_id;

  if wants_it is not false then
    return query select ps.endpoint, ps.p256dh, ps.auth from public.push_subscriptions ps where ps.user_id = p_user_id;
  end if;
  return;
end;
$$;
grant execute on function public.get_push_targets(uuid, text) to authenticated, service_role;

-- ============================================================================
-- Admin API keys — programmatic access for a workspace's own scripts/tools.
-- Only the SHA-256 hash is ever stored; the real key is shown once at creation.
-- ============================================================================
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  created_by uuid references public.profiles(id) on delete set null,
  last_used_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists api_keys_hash_idx on public.api_keys(key_hash);
create index if not exists api_keys_workspace_idx on public.api_keys(workspace_id);
alter table public.api_keys enable row level security;
drop policy if exists api_keys_select_admin on public.api_keys;
create policy api_keys_select_admin on public.api_keys for select to authenticated using (public.is_workspace_admin(workspace_id));
drop policy if exists api_keys_insert_admin on public.api_keys;
create policy api_keys_insert_admin on public.api_keys for insert to authenticated with check (public.is_workspace_admin(workspace_id) and created_by = auth.uid());
drop policy if exists api_keys_update_admin on public.api_keys;
create policy api_keys_update_admin on public.api_keys for update to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

-- ============================================================================
-- Incoming webhooks — turns any external tool (Zapier, Make, n8n, a custom
-- script) into a real PULSE integration without a dedicated OAuth app per
-- platform. Each webhook has its own unguessable token in the URL itself.
-- ============================================================================
create table if not exists public.incoming_webhooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by uuid references public.profiles(id) on delete set null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.incoming_webhooks enable row level security;
drop policy if exists incoming_webhooks_select_admin on public.incoming_webhooks;
create policy incoming_webhooks_select_admin on public.incoming_webhooks for select to authenticated using (public.is_workspace_admin(workspace_id));
drop policy if exists incoming_webhooks_insert_admin on public.incoming_webhooks;
create policy incoming_webhooks_insert_admin on public.incoming_webhooks for insert to authenticated with check (public.is_workspace_admin(workspace_id) and created_by = auth.uid());
drop policy if exists incoming_webhooks_delete_admin on public.incoming_webhooks;
create policy incoming_webhooks_delete_admin on public.incoming_webhooks for delete to authenticated using (public.is_workspace_admin(workspace_id));

-- ============================================================================
-- Configurable data retention — applies only to raw Discussions/Messages.
-- Decisions are never auto-cleaned: PULSE's whole premise is that decisions
-- are kept forever, so retention deliberately does not touch them.
-- ============================================================================
alter table public.workspaces add column if not exists discussion_retention_days integer;

create or replace function public.run_data_retention_cleanup() returns void language plpgsql security definer set search_path = public as $$
begin
  update public.discussions
  set status = 'archived'
  from public.workspaces w
  where discussions.workspace_id = w.id
    and w.discussion_retention_days is not null
    and discussions.status <> 'archived'
    and discussions.updated_at < now() - (w.discussion_retention_days || ' days')::interval;
end;
$$;
grant execute on function public.run_data_retention_cleanup() to service_role;

-- Schedule it daily once pg_cron is enabled (Dashboard > Database >
-- Extensions), same as the digest emails above:
-- select cron.schedule('pulse-data-retention', '0 3 * * *', $$ select public.run_data_retention_cleanup(); $$);

notify pgrst, 'reload schema';

-- ============================================================================
-- Integrations upgrade — OAuth token refresh support (Google/Microsoft need
-- refresh tokens since their access tokens expire in ~1 hour) + Notion's
-- simpler token-paste flow reuses the same table via metadata.
-- ============================================================================
alter table public.workspace_integrations add column if not exists refresh_token text;
alter table public.workspace_integrations add column if not exists expires_at timestamptz;

-- Jira sync: lets an Action carry a linked Jira issue key once synced.
alter table public.actions add column if not exists jira_issue_key text;

notify pgrst, 'reload schema';

-- ============================================================================
-- SSO — real code against Supabase Auth's actual public SSO API
-- (supabase.auth.signInWithSSO). The SAML identity-provider handshake itself
-- is Supabase's own gated feature (Team/Enterprise add-on + `supabase sso
-- add` via their CLI) — this table's job is just mapping a verified email
-- domain to the right PULSE workspace once someone signs in that way.
-- ============================================================================
create table if not exists public.workspace_sso_domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain text not null unique,
  default_role public.workspace_role not null default 'member',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.workspace_sso_domains enable row level security;
drop policy if exists workspace_sso_domains_select_member on public.workspace_sso_domains;
create policy workspace_sso_domains_select_member on public.workspace_sso_domains for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists workspace_sso_domains_admin_all on public.workspace_sso_domains;
create policy workspace_sso_domains_admin_all on public.workspace_sso_domains for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

-- Runs right after a real SSO sign-in completes: if the user's email domain
-- matches a registered workspace, add them to it automatically instead of
-- leaving them stranded with no workspace.
create or replace function public.handle_sso_login() returns trigger language plpgsql security definer set search_path = public as $$
declare matched_domain public.workspace_sso_domains;
begin
  if new.email is null then return new; end if;
  select * into matched_domain from public.workspace_sso_domains where new.email ilike '%@' || domain limit 1;
  if matched_domain.id is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (matched_domain.workspace_id, new.id, matched_domain.default_role)
    on conflict (workspace_id, user_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists on_sso_user_created on auth.users;
create trigger on_sso_user_created after insert on auth.users for each row execute procedure public.handle_sso_login();

notify pgrst, 'reload schema';


-- ============================================================================
-- PULSE Automation Engine (idempotent)
-- ============================================================================
create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  trigger text not null check (trigger in ('action_due_soon','action_overdue','high_priority_overdue')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(workspace_id, trigger)
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  action_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;
drop policy if exists automation_rules_member on public.automation_rules;
create policy automation_rules_member on public.automation_rules for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists automation_rules_admin_update on public.automation_rules;
create policy automation_rules_admin_update on public.automation_rules for update to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop policy if exists automation_runs_member on public.automation_runs;
create policy automation_runs_member on public.automation_runs for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.seed_automation_rules(target_workspace uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_workspace_member(target_workspace) then raise exception 'Not authorized'; end if;
  insert into public.automation_rules(workspace_id,name,trigger) values
    (target_workspace,'Upcoming action reminder','action_due_soon'),
    (target_workspace,'Overdue action alert','action_overdue'),
    (target_workspace,'High-priority escalation','high_priority_overdue')
  on conflict (workspace_id,trigger) do nothing;
end; $$;

create or replace function public.run_workspace_automations(target_workspace uuid)
returns table(processed integer, notifications integer)
language plpgsql security definer set search_path = public as $$
declare
  r record; a record; p integer := 0; n integer := 0; already boolean;
begin
  if not public.is_workspace_member(target_workspace) then raise exception 'Not authorized'; end if;
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
        insert into public.notifications(user_id,type,title,body) values
          (a.owner_id,'automation:'||r.trigger,r.name, a.title||' ['||a.id::text||']');
        n := n + 1;
      end if;
    end loop;
    insert into public.automation_runs(workspace_id,rule_id,action_count) values(target_workspace,r.id,p);
  end loop;
  return query select p,n;
end; $$;

grant execute on function public.run_workspace_automations(uuid) to authenticated;
grant execute on function public.seed_automation_rules(uuid) to authenticated;

-- ============================================================================
-- Production security hardening: one-time OAuth state + protected integration secrets
-- ============================================================================
create table if not exists public.oauth_states (
  state uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('slack', 'google', 'microsoft365', 'jira')),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.oauth_states enable row level security;
revoke all on public.oauth_states from anon, authenticated;
create index if not exists oauth_states_expiry_idx on public.oauth_states(expires_at);

-- Browser clients never need to read provider credentials. Disconnects now happen
-- through a server-side Edge Function, so the client does not need UPDATE access
-- to secret token columns.
revoke select (access_token, refresh_token, expires_at) on public.workspace_integrations from anon, authenticated;
revoke update (access_token, refresh_token, expires_at, metadata, connected_by) on public.workspace_integrations from anon, authenticated;

-- Clean up abandoned OAuth sessions periodically. This is safe to run from a scheduled job.
create or replace function public.cleanup_expired_oauth_states() returns integer
language plpgsql security definer set search_path = public as $$
declare deleted_count integer;
begin
  delete from public.oauth_states where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function public.cleanup_expired_oauth_states() from public;
grant execute on function public.cleanup_expired_oauth_states() to service_role;

notify pgrst, 'reload schema';


-- ============================================================================
-- PULSE Phase 1: Decision Graph + Outcome Tracking + Pre-Decision Gate
-- Safe to run repeatedly.
-- ============================================================================

alter table public.decisions
  add column if not exists outcome_score numeric check (outcome_score >= 1 and outcome_score <= 5),
  add column if not exists last_outcome_review_at timestamptz,
  add column if not exists is_reversed boolean not null default false,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reversal_reason text,
  add column if not exists decision_gate jsonb not null default '{}'::jsonb;

-- Permanent edges between decision nodes.
create table if not exists public.decision_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_decision_id uuid not null references public.decisions(id) on delete cascade,
  to_decision_id uuid not null references public.decisions(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('depends_on','supersedes','related','blocks','unlocked')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint decision_links_not_self check (from_decision_id <> to_decision_id),
  unique(from_decision_id, to_decision_id, relationship_type)
);
create index if not exists decision_links_workspace_idx on public.decision_links(workspace_id);
create index if not exists decision_links_from_idx on public.decision_links(from_decision_id);
create index if not exists decision_links_to_idx on public.decision_links(to_decision_id);

create or replace function public.validate_decision_link_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
declare from_ws uuid; to_ws uuid;
begin
  select workspace_id into from_ws from public.decisions where id = new.from_decision_id;
  select workspace_id into to_ws from public.decisions where id = new.to_decision_id;
  if from_ws is null or to_ws is null or from_ws <> to_ws or new.workspace_id <> from_ws then
    raise exception 'Linked decisions must belong to the same workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_decision_link_workspace on public.decision_links;
create trigger validate_decision_link_workspace
before insert or update on public.decision_links
for each row execute function public.validate_decision_link_workspace();

alter table public.decision_links enable row level security;
drop policy if exists decision_links_select_member on public.decision_links;
create policy decision_links_select_member on public.decision_links for select to authenticated
using (public.is_workspace_member(workspace_id));
drop policy if exists decision_links_insert_admin on public.decision_links;
create policy decision_links_insert_admin on public.decision_links for insert to authenticated
with check (public.is_workspace_admin(workspace_id) and created_by = auth.uid());
drop policy if exists decision_links_delete_admin on public.decision_links;
create policy decision_links_delete_admin on public.decision_links for delete to authenticated
using (public.is_workspace_admin(workspace_id));

-- A decision receives one review at 30/90/180 days. The unique constraint makes
-- the daily scheduler race-safe.
create table if not exists public.decision_outcome_reviews (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scheduled_for date not null,
  review_type text not null check (review_type in ('30d','90d','180d')),
  status text not null default 'pending' check (status in ('pending','completed','skipped','overdue')),
  was_successful boolean,
  score integer check (score between 1 and 5),
  what_happened text,
  lessons text,
  should_reverse boolean not null default false,
  reverse_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(decision_id, review_type)
);
create index if not exists decision_outcome_reviews_decision_idx on public.decision_outcome_reviews(decision_id, scheduled_for);
create index if not exists decision_outcome_reviews_workspace_status_idx on public.decision_outcome_reviews(workspace_id, status);
create index if not exists decision_outcome_reviews_pending_idx on public.decision_outcome_reviews(scheduled_for) where status in ('pending','overdue');

alter table public.decision_outcome_reviews enable row level security;
drop policy if exists decision_outcome_reviews_select_member on public.decision_outcome_reviews;
create policy decision_outcome_reviews_select_member on public.decision_outcome_reviews for select to authenticated
using (public.is_workspace_member(workspace_id));

-- Only the decision owner, creator, or workspace admin can submit a review.
create or replace function public.submit_decision_outcome_review(
  p_review_id uuid,
  p_was_successful boolean,
  p_score integer,
  p_what_happened text default null,
  p_lessons text default null,
  p_should_reverse boolean default false,
  p_reverse_reason text default null
)
returns public.decision_outcome_reviews
language plpgsql security definer set search_path = public
as $$
declare r public.decision_outcome_reviews; d public.decisions; avg_score numeric;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_score < 1 or p_score > 5 then raise exception 'Score must be between 1 and 5'; end if;

  select * into r from public.decision_outcome_reviews where id = p_review_id for update;
  if r.id is null then raise exception 'Outcome review not found'; end if;
  select * into d from public.decisions where id = r.decision_id;
  if d.id is null then raise exception 'Decision not found'; end if;
  if not public.is_workspace_member(r.workspace_id) then raise exception 'Not a workspace member'; end if;
  if not (public.is_workspace_admin(r.workspace_id) or d.owner_id = auth.uid() or d.created_by = auth.uid()) then
    raise exception 'Only the decision owner, creator, or workspace admin can submit this review';
  end if;

  update public.decision_outcome_reviews
  set status = 'completed',
      was_successful = p_was_successful,
      score = p_score,
      what_happened = nullif(trim(coalesce(p_what_happened,'')), ''),
      lessons = nullif(trim(coalesce(p_lessons,'')), ''),
      should_reverse = p_should_reverse,
      reverse_reason = nullif(trim(coalesce(p_reverse_reason,'')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_review_id
  returning * into r;

  select avg(score)::numeric(4,2) into avg_score
  from public.decision_outcome_reviews
  where decision_id = r.decision_id and status = 'completed' and score is not null;

  update public.decisions
  set outcome_score = avg_score,
      last_outcome_review_at = now(),
      is_reversed = case when p_should_reverse then true else is_reversed end,
      reversed_at = case when p_should_reverse then now() else reversed_at end,
      reversed_by = case when p_should_reverse then auth.uid() else reversed_by end,
      reversal_reason = case when p_should_reverse then nullif(trim(coalesce(p_reverse_reason,'')), '') else reversal_reason end,
      updated_at = now()
  where id = r.decision_id;

  insert into public.decision_history(decision_id,status,outcome,note,changed_by)
  values (
    r.decision_id,
    d.status,
    d.outcome,
    case
      when p_should_reverse then 'Outcome review completed: decision reversed. ' || coalesce(nullif(trim(p_reverse_reason), ''), '')
      else 'Outcome review completed: ' || case when p_was_successful then 'successful' else 'not successful' end || ' (' || p_score || '/5).'
    end,
    auth.uid()
  );

  return r;
end;
$$;
grant execute on function public.submit_decision_outcome_review(uuid, boolean, integer, text, text, boolean, text) to authenticated;

-- Daily scheduler: service role only. It is idempotent and also marks late
-- reviews overdue so the UI can surface them clearly.
create or replace function public.create_due_decision_outcome_reviews()
returns integer
language plpgsql security definer set search_path = public
as $$
declare d record; inserted_count integer := 0; review_date date; review_kind text;
begin
  update public.decision_outcome_reviews
  set status = 'overdue', updated_at = now()
  where status = 'pending' and scheduled_for < current_date;

  for d in
    select id, workspace_id, decided_at
    from public.decisions
    where status = 'decided' and decided_at is not null
  loop
    foreach review_kind in array array['30d','90d','180d'] loop
      review_date := case review_kind
        when '30d' then (d.decided_at::date + 30)
        when '90d' then (d.decided_at::date + 90)
        else (d.decided_at::date + 180)
      end;
      insert into public.decision_outcome_reviews(decision_id,workspace_id,scheduled_for,review_type)
      values(d.id,d.workspace_id,review_date,review_kind)
      on conflict (decision_id,review_type) do nothing;
      if found then
        inserted_count := inserted_count + 1;
        insert into public.notifications(user_id,type,title,body)
        select coalesce(dec.owner_id, dec.created_by),
          'decision_outcome_review',
          'Outcome review due',
          'Your ' || review_kind || ' outcome review is scheduled for decision: ' || dec.title
        from public.decisions dec
        where dec.id = d.id
          and coalesce(dec.owner_id, dec.created_by) is not null;
      end if;
    end loop;
  end loop;
  return inserted_count;
end;
$$;
revoke all on function public.create_due_decision_outcome_reviews() from public;
grant execute on function public.create_due_decision_outcome_reviews() to service_role;

do $$ begin
  alter publication supabase_realtime add table public.decision_links;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.decision_outcome_reviews;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';


-- Optional pg_cron schedule (Database > Extensions > pg_cron):
-- select cron.schedule(
--   'pulse-outcome-reviews',
--   '15 2 * * *',
--   $$ select public.create_due_decision_outcome_reviews(); $$
-- );

-- ============================================================================
-- PULSE Subscription Entitlements 1.0
-- Central plan source of truth used by gated UI and server-side functions.
-- ============================================================================
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

-- PULSE Server Usage Enforcement 1.0
-- See supabase/migrations/20260914_server_usage_enforcement.sql for details.
create table if not exists public.workspace_usage_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric text not null check (metric in ('ai_analyses','automations')), actor_id uuid references auth.users(id) on delete set null,
  idempotency_key text, created_at timestamptz not null default now()
);
create index if not exists workspace_usage_events_workspace_metric_created_idx on public.workspace_usage_events(workspace_id, metric, created_at desc);
create unique index if not exists workspace_usage_events_idempotency_idx on public.workspace_usage_events(workspace_id, metric, idempotency_key) where idempotency_key is not null;
alter table public.workspace_usage_events enable row level security;
drop policy if exists workspace_usage_events_select_member on public.workspace_usage_events;
create policy workspace_usage_events_select_member on public.workspace_usage_events for select to authenticated using (public.is_workspace_member(workspace_id));
-- The full server-side RPC/trigger definitions live in the migration above and should be applied to Supabase.
