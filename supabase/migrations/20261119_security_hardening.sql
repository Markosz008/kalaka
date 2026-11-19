begin;

create or replace function public.protect_profile_columns()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.ride_hearts := 0;
      new.favor_hearts := 0;
      new.strike_count := 0;
      new.is_suspended := false;
      new.is_admin := false;
      new.is_gps_local_verified := false;
    else
      new.ride_hearts := old.ride_hearts;
      new.favor_hearts := old.favor_hearts;
      new.strike_count := old.strike_count;
      new.is_suspended := old.is_suspended;
      new.is_admin := old.is_admin;
      new.is_gps_local_verified := old.is_gps_local_verified;
    end if;
  end if;
  return new;
end $$;

create or replace function public.verify_local_gps(p_lat double precision, p_lng double precision)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Bejelentkezés szükséges';
  end if;

  if p_lat between 47.6200 and 47.7200 and p_lng between 19.0100 and 19.1200 then
    update public.profiles
       set is_gps_local_verified = true
     where id = auth.uid();
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.verify_local_gps(double precision, double precision) from public;
grant execute on function public.verify_local_gps(double precision, double precision) to authenticated;

create unique index if not exists idx_kudos_unique_agreement_giver
  on public.kudos (agreement_id, giver_id);

alter table public.kudos enable row level security;

drop policy if exists "Authenticated users can insert valid kudos" on public.kudos;
create policy "Authenticated users can insert valid kudos" on public.kudos
  for insert to authenticated
  with check (
    giver_id = auth.uid()
    and giver_id <> receiver_id
    and exists (
      select 1 from public.agreements a
      where a.id = agreement_id
        and (
          (a.requester_id = giver_id and a.helper_id = receiver_id)
          or (a.helper_id = giver_id and a.requester_id = receiver_id)
        )
    )
  );

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
