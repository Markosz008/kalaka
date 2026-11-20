create or replace function public.validate_beta_invite(p_code text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_inviter record;
  v_member_used integer := 0;
begin
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
$function$;

create or replace function public.redeem_beta_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_group record;
  v_inviter record;
  v_already boolean;
  v_member_used integer := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Bejelentkezés szükséges.');
  end if;

  select beta_approved into v_already
  from public.profiles
  where id = v_uid;

  if v_already = true then
    return jsonb_build_object('ok', true, 'already_approved', true);
  end if;

  if length(v_code) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Add meg az érvényes meghívókódot.');
  end if;

  select * into v_group
  from public.beta_invite_codes
  where code = v_code
    and is_active = true
    and used_count < max_uses
  for update;

  if found then
    update public.beta_invite_codes
      set used_count = used_count + 1
      where code = v_group.code;

    update public.profiles
      set beta_approved = true,
          invited_by = coalesce(invited_by, v_group.created_by)
      where id = v_uid;

    return jsonb_build_object('ok', true, 'source', 'group', 'label', v_group.label);
  end if;

  select id, display_name, is_admin into v_inviter
  from public.profiles
  where upper(invite_code) = v_code
    and id <> v_uid
    and (beta_approved = true or is_admin = true)
  limit 1
  for update;

  if found then
    if not coalesce(v_inviter.is_admin, false) then
      select count(*) into v_member_used
      from public.profiles
      where invited_by = v_inviter.id;

      if v_member_used >= 10 then
        return jsonb_build_object('ok', false, 'error', 'Ennek a meghívókódnak betelt a 10 fős kerete.');
      end if;
    end if;

    update public.profiles
      set beta_approved = true,
          invited_by = coalesce(invited_by, v_inviter.id)
      where id = v_uid;

    return jsonb_build_object('ok', true, 'source', 'member', 'inviter_name', v_inviter.display_name);
  end if;

  return jsonb_build_object('ok', false, 'error', 'Érvénytelen vagy már betelt meghívókód.');
end;
$function$;
