alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.messages replica identity full;

drop policy if exists "Sender can edit or soft-delete own messages" on public.messages;
create policy "Sender can edit or soft-delete own messages"
  on public.messages
  for update
  using (
    sender_id = auth.uid()
    and coalesce(is_system_event, false) = false
    and exists (
      select 1
      from public.agreements a
      where a.id = messages.agreement_id
        and (a.requester_id = auth.uid() or a.helper_id = auth.uid())
    )
  )
  with check (
    sender_id = auth.uid()
    and coalesce(is_system_event, false) = false
    and exists (
      select 1
      from public.agreements a
      where a.id = messages.agreement_id
        and (a.requester_id = auth.uid() or a.helper_id = auth.uid())
    )
  );

create or replace function public.guard_message_update()
returns trigger
language plpgsql
as $$
begin
  if old.is_system_event then
    raise exception 'Rendszerüzenet nem módosítható';
  end if;
  if old.deleted_at is not null then
    raise exception 'Törölt üzenet nem módosítható';
  end if;
  new.agreement_id := old.agreement_id;
  new.sender_id := old.sender_id;
  new.is_system_event := old.is_system_event;
  new.created_at := old.created_at;
  if new.deleted_at is not null then
    new.body := 'Üzenet törölve';
  elsif new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_message_update on public.messages;
create trigger trg_guard_message_update
  before update on public.messages
  for each row
  execute function public.guard_message_update();
