begin;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

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
    else
      new.ride_hearts := old.ride_hearts;
      new.favor_hearts := old.favor_hearts;
      new.strike_count := old.strike_count;
      new.is_suspended := old.is_suspended;
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end $$;

create table if not exists public.pro_claim_requests (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references public.local_pros(id) on delete cascade,
  claimant_id uuid not null references public.profiles(id) on delete cascade,
  contact_phone text not null,
  verification_note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

alter table public.pro_claim_requests enable row level security;

drop policy if exists "Claimants can create pending claims" on public.pro_claim_requests;
create policy "Claimants can create pending claims" on public.pro_claim_requests
  for insert to authenticated
  with check (
    claimant_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.local_pros lp
      where lp.id = pro_id and lp.owner_id is null
    )
  );

drop policy if exists "Users and admins can read claims" on public.pro_claim_requests;
create policy "Users and admins can read claims" on public.pro_claim_requests
  for select to authenticated
  using (
    claimant_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create or replace function public.review_pro_claim(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ) then
    raise exception 'Csak admin hagyhatja jóvá az igénylést';
  end if;

  select * into v_req
  from public.pro_claim_requests
  where id = p_request_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Az igénylés nem található vagy már elbírálták';
  end if;

  if p_approve then
    update public.local_pros
       set owner_id = v_req.claimant_id
     where id = v_req.pro_id
       and owner_id is null;

    update public.pro_claim_requests
       set status = 'approved',
           reviewed_at = now(),
           reviewed_by = auth.uid()
     where id = p_request_id;

    update public.pro_claim_requests
       set status = 'rejected',
           reviewed_at = now(),
           reviewed_by = auth.uid()
     where pro_id = v_req.pro_id
       and id <> p_request_id
       and status = 'pending';
  else
    update public.pro_claim_requests
       set status = 'rejected',
           reviewed_at = now(),
           reviewed_by = auth.uid()
     where id = p_request_id;
  end if;
end;
$$;

revoke all on function public.review_pro_claim(uuid, boolean) from public;
grant execute on function public.review_pro_claim(uuid, boolean) to authenticated;

commit;
