begin;

create or replace function public.protect_profile_columns()
returns trigger language plpgsql as $$ begin if current_user = 'authenticated' then if tg_op = 'INSERT' then new.ride_hearts := 0; new.favor_hearts := 0; new.strike_count := 0; new.is_suspended := false; else new.ride_hearts := old.ride_hearts; new.favor_hearts := old.favor_hearts; new.strike_count := old.strike_count; new.is_suspended := old.is_suspended; end if; end if; return new; end $$;

drop trigger if exists trg_protect_profile_columns on public.profiles;
create trigger trg_protect_profile_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_columns();

create or replace function public.sync_profile_hearts_on_kudos()
returns trigger language plpgsql security definer set search


cd ~/Desktop/kalaka_szentendre_vite_mvp

# 1. .gitignore megerősítése (hogy a .env és a backup mappák sose kerüljenek fel)
cat << 'EOF' > .gitignore
node_modules/
dist/
.env
.env.*
.wrangler/
src_backup/
.DS_Store
*.log
*.zip
EOF

# 2. Biztonsági SQL migráció mentése a repóba (hogy verziózva legyen a séma-védelem)
mkdir -p supabase/migrations
cat << 'EOF_SQL' > supabase/migrations/20261113_harden_rls.sql
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
    else
      new.ride_hearts := old.ride_hearts;
      new.favor_hearts := old.favor_hearts;
      new.strike_count := old.strike_count;
      new.is_suspended := old.is_suspended;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_profile_columns on public.profiles;
create trigger trg_protect_profile_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_columns();

create or replace function public.sync_profile_hearts_on_kudos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p
     set ride_hearts = (
           select count(*) from public.kudos k
            where k.receiver_id = p.id and k.kudos_type = 'ride'
         ),
         favor_hearts = (
           select count(*) from public.kudos k
            where k.receiver_id = p.id and k.kudos_type = 'favor'
         )
   where p.id = new.receiver_id;

  update public.agreements
     set status = 'completed'
   where id = new.agreement_id and status <> 'completed';

  return new;
end $$;

drop trigger if exists trg_sync_profile_hearts_on_kudos on public.kudos;
create trigger trg_sync_profile_hearts_on_kudos
  after insert on public.kudos
  for each row execute function public.sync_profile_hearts_on_kudos();

create or replace function public.guard_agreement_update()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if new.requester_id is distinct from old.requester_id
       or new.helper_id is distinct from old.helper_id
       or new.ride_id is distinct from old.ride_id
       or new.favor_id is distinct from old.favor_id
       or new.pro_id is distinct from old.pro_id then
      raise exception 'A megállapodás résztvevői nem módosíthatók';
    end if;
    if new.requester_agreed is distinct from old.requester_agreed
       and auth.uid() is distinct from old.requester_id then
      raise exception 'Ezt csak a kérő erősítheti meg';
    end if;
    if new.helper_agreed is distinct from old.helper_agreed
       and auth.uid() is distinct from old.helper_id then
      raise exception 'Ezt csak a segítő erősítheti meg';
    end if;
    if new.status = 'completed' and old.status is distinct from new.status
       and auth.uid() is distinct from old.requester_id then
      raise exception 'A teljesítést csak a kérő zárhatja le';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_agreement_update on public.agreements;
create trigger trg_guard_agreement_update
  before update on public.agreements
  for each row execute function public.guard_agreement_update();

create or replace function public.protect_pro_columns()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.endorsement_count := 0;
    else
      new.endorsement_count := old.endorsement_count;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_pro_columns on public.local_pros;
create trigger trg_protect_pro_columns
  before insert or update on public.local_pros
  for each row execute function public.protect_pro_columns();

create or replace function public.sync_pro_endorsement_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_id uuid := coalesce(new.pro_id, old.pro_id);
begin
  update public.local_pros lp
     set endorsement_count = (select count(*) from public.pro_endorsements e where e.pro_id = lp.id)
   where lp.id = target_id;
  return null;
end $$;

drop trigger if exists trg_sync_pro_endorsement_count on public.pro_endorsements;
create trigger trg_sync_pro_endorsement_count
  after insert or delete on public.pro_endorsements
  for each row execute function public.sync_pro_endorsement_count();

alter table public.reports enable row level security;
drop policy if exists "Users can file reports" on public.reports;
create policy "Users can file reports" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists "Users can read own reports" on public.reports;
create policy "Users can read own reports" on public.reports
  for select to authenticated using (reporter_id = auth.uid());

commit;
