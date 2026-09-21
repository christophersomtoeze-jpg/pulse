-- PULSE Launch Build 4: notification controls + deep-link metadata.
-- Notifications remain user-owned; audit logs remain immutable.

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, created_at desc)
  where read_at is null;

drop policy if exists notifications_delete_self on public.notifications;
create policy notifications_delete_self
  on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- Future outcome-review notifications carry their decision id so the UI can open the exact Decision Room.
create or replace function public.create_due_decision_outcome_reviews()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  d record;
  inserted_count integer := 0;
  review_date date;
  review_kind text;
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
          'Your ' || review_kind || ' outcome review is scheduled for decision: ' || dec.title || ' [' || dec.id::text || ']'
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
grant execute on function public.create_due_decision_outcome_reviews() to authenticated;
notify pgrst, 'reload schema';
