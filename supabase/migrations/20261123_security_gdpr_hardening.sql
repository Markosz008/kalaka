begin;

alter table public.rides
  add column if not exists push_sent_at timestamptz;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Bejelentkezés szükséges';
  end if;

  delete from public.push_subscriptions where user_id = v_uid;
  delete from public.road_alert_votes where user_id = v_uid;
  delete from public.messages where sender_id = v_uid;
  delete from public.road_alerts where reporter_id = v_uid;
  delete from public.pro_endorsements where user_id = v_uid;
  delete from public.pro_interactions where user_id = v_uid;
  delete from public.kudos where giver_id = v_uid or receiver_id = v_uid;
  delete from public.agreements where requester_id = v_uid or helper_id = v_uid;
  delete from public.rides where user_id = v_uid;
  delete from public.favors where user_id = v_uid;
  delete from public.local_pros where owner_id = v_uid;
  delete from public.profiles where id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

commit;
