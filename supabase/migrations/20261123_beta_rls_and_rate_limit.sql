create or replace function public.is_beta_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (coalesce(beta_approved, false) = true or coalesce(is_admin, false) = true)
  );
$$;

revoke all on function public.is_beta_member() from public;
grant execute on function public.is_beta_member() to anon, authenticated;

drop policy if exists "Profiles viewable by authenticated users" on public.profiles;
create policy "Profiles viewable by self or beta members"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id or public.is_beta_member());

drop policy if exists "Rides viewable by everyone" on public.rides;
create policy "Rides viewable by beta members"
  on public.rides
  for select
  to authenticated
  using (public.is_beta_member());

drop policy if exists "Favors viewable by everyone" on public.favors;
create policy "Favors viewable by beta members"
  on public.favors
  for select
  to authenticated
  using (public.is_beta_member());

drop policy if exists "local_pros_public_read" on public.local_pros;
create policy "Local pros viewable by beta members"
  on public.local_pros
  for select
  to authenticated
  using (public.is_beta_member());

drop policy if exists "Road alerts viewable by everyone" on public.road_alerts;
create policy "Road alerts viewable by beta members"
  on public.road_alerts
  for select
  to authenticated
  using (expires_at > now() and public.is_beta_member());

create table if not exists public.beta_invite_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_beta_invite_attempts_ip_time
  on public.beta_invite_attempts (ip_hash, attempted_at desc);

alter table public.beta_invite_attempts enable row level security;
revoke all on table public.beta_invite_attempts from public, anon, authenticated;

create or replace function public.validate_beta_invite(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_inviter record;
  v_member_used integer := 0;
  v_headers jsonb;
  v_raw_ip text;
  v_ip_hash text;
  v_recent_attempts integer := 0;
begin
  v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_raw_ip := trim(
    split_part(
      coalesce(v_headers->>'cf-connecting-ip', v_headers->>'x-forwarded-for', 'unknown'),
      ',',
      1
    )
  );
  v_ip_hash := md5(coalesce(nullif(v_raw_ip, ''), 'unknown'));

  delete from public.beta_invite_attempts
  where attempted_at < now() - interval '15 minutes';

  select count(*) into v_recent_attempts
  from public.beta_invite_attempts
  where ip_hash = v_ip_hash
    and attempted_at > now() - interval '15 minutes';

  if v_recent_attempts >= 12 then
    return false;
  end if;

  insert into public.beta_invite_attempts (ip_hash) values (v_ip_hash);

  if length(v_code) < 3 then
    return false;
  end if;

  if exists (
    select 1
    from public.beta_invite_codes
    where code = v_code
      and is_active = true
      and used_count < max_uses
  ) then
    return true;
  end if;

  select id, is_admin into v_inviter
  from public.profiles
  where upper(invite_code) = v_code
    and (beta_approved = true or is_admin = true)
  limit 1;

  if not found then
    return false;
  end if;

  if coalesce(v_inviter.is_admin, false) then
    return true;
  end if;

  select count(*) into v_member_used
  from public.profiles
  where invited_by = v_inviter.id;

  return v_member_used < 10;
end;
$$;

revoke all on function public.validate_beta_invite(text) from public;
grant execute on function public.validate_beta_invite(text) to anon, authenticated;

revoke all on function public.redeem_beta_invite(text) from public, anon;
grant execute on function public.redeem_beta_invite(text) to authenticated;
