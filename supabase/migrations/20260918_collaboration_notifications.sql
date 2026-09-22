-- PULSE Launch Build 5: collaboration notifications + message/audit navigation.

alter table public.notifications add column if not exists target_type text;
alter table public.notifications add column if not exists target_id uuid;
alter table public.notifications add column if not exists target_comment_id uuid;

create index if not exists notifications_target_idx on public.notifications(target_type, target_id) where target_id is not null;

create or replace function public.create_decision_comment_notification(
  p_decision_id uuid, p_comment_id uuid, p_recipient_id uuid, p_type text, p_title text, p_body text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_workspace_id uuid; v_id uuid;
begin
  select workspace_id into v_workspace_id from public.decisions where id = p_decision_id;
  if v_workspace_id is null or not public.is_workspace_member(v_workspace_id) then raise exception 'Not authorized'; end if;
  if not exists (select 1 from public.workspace_members where workspace_id = v_workspace_id and user_id = p_recipient_id) then raise exception 'Recipient is not a workspace member'; end if;
  insert into public.notifications(user_id,type,title,body,target_type,target_id,target_comment_id)
  values(p_recipient_id,p_type,p_title,p_body,'decision_comment',p_decision_id,p_comment_id) returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.create_decision_comment_notification(uuid,uuid,uuid,text,text,text) from public;
grant execute on function public.create_decision_comment_notification(uuid,uuid,uuid,text,text,text) to authenticated;

create or replace function public.log_decision_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare v_workspace_id uuid; v_actor_name text;
begin
  select workspace_id into v_workspace_id from public.decisions where id = new.decision_id;
  select full_name into v_actor_name from public.profiles where id = new.author_id;
  if v_workspace_id is not null then
    insert into public.audit_log(workspace_id, actor_id, action, detail)
    values(v_workspace_id, new.author_id, 'decision_comment_added', jsonb_build_object('decision_id', new.decision_id, 'comment_id', new.id, 'author', coalesce(v_actor_name,'PULSE Member'), 'parent_comment_id', new.parent_comment_id)::text);
  end if;
  return new;
end; $$;

drop trigger if exists on_decision_comment_audit on public.decision_comments;
create trigger on_decision_comment_audit after insert on public.decision_comments for each row execute procedure public.log_decision_comment();

notify pgrst, 'reload schema';
