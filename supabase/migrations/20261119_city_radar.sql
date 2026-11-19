begin;

alter table public.road_alerts
  add column if not exists category text not null default 'traffic',
  add column if not exists zone text not null default '11-es út',
  add column if not exists confirm_count integer not null default 1,
  add column if not exists clear_count integer not null default 0,
  add column if not exists updates jsonb not null default '[]'::jsonb,
  add column if not exists last_confirmed_at timestamptz not null default now(),
  add column if not exists push_sent_at timestamptz;

create table if not exists public.road_alert_votes (
  alert_id uuid not null references public.road_alerts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('confirm', 'clear')),
  created_at timestamptz not null default now(),
  primary key (alert_id, user_id)
);

alter table public.road_alert_votes enable row level security;

drop policy if exists "Authenticated can read alert votes" on public.road_alert_votes;
create policy "Authenticated can read alert votes" on public.road_alert_votes
  for select to authenticated using (true);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  categories text[] not null default array['traffic', 'transit', 'utility', 'local'],
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.submit_city_alert(
  p_category text,
  p_zone text,
  p_status_level text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cat text := coalesce(nullif(trim(p_category), ''), 'traffic');
  v_zone text := coalesce(nullif(trim(p_zone), ''), '11-es út');
  v_level text := coalesce(nullif(trim(p_status_level), ''), 'warn');
  v_msg text := left(trim(coalesce(p_message, '')), 220);
  v_author text;
  v_ttl interval;
  v_existing record;
  v_new_id uuid;
  v_updates jsonb;
  v_confirm int;
  v_clear int;
  v_should_push boolean := false;
  v_recent_push boolean := false;
begin
  if v_uid is null then
    raise exception 'Bejelentkezés szükséges';
  end if;

  if v_cat not in ('traffic', 'transit', 'utility', 'local') then
    v_cat := 'traffic';
  end if;

  if v_level not in ('ok', 'warn', 'danger') then
    v_level := 'warn';
  end if;

  if char_length(v_msg) < 4 then
    raise exception 'Adj meg rövid leírást (legalább 4 karakter)';
  end if;

  select coalesce(nullif(display_name, ''), 'Helyi lakos')
    into v_author
    from public.profiles
   where id = v_uid;

  v_ttl := case v_cat
    when 'traffic' then interval '45 minutes'
    when 'transit' then interval '60 minutes'
    when 'utility' then interval '3 hours'
    when 'local'   then interval '6 hours'
    else interval '45 minutes'
  end;

  select *
    into v_existing
    from public.road_alerts
   where category = v_cat
     and zone = v_zone
     and expires_at > now()
     and status_level <> 'ok'
   order by created_at desc
   limit 1
   for update;

  if found then
    if v_level = 'ok' then
      return public.vote_city_alert(v_existing.id, 'clear', v_msg);
    end if;

    insert into public.road_alert_votes (alert_id, user_id, vote)
    values (v_existing.id, v_uid, 'confirm')
    on conflict (alert_id, user_id)
    do update set vote = 'confirm', created_at = now();

    select
      count(*) filter (where vote = 'confirm'),
      count(*) filter (where vote = 'clear')
      into v_confirm, v_clear
      from public.road_alert_votes
     where alert_id = v_existing.id;

    v_updates := coalesce(v_existing.updates, '[]'::jsonb);
    if lower(v_msg) <> lower(v_existing.message) then
      v_updates := v_updates || jsonb_build_array(
        jsonb_build_object(
          'text', v_msg,
          'author', coalesce(v_author, 'Helyi lakos'),
          'at', now()
        )
      );
      if jsonb_array_length(v_updates) > 6 then
        select jsonb_agg(elem)
          into v_updates
          from (
            select elem
              from jsonb_array_elements(v_updates) with ordinality as t(elem, ord)
             order by ord desc
             limit 6
          ) sub;
      end if;
    end if;

    select exists (
      select 1 from public.road_alerts
       where category = v_cat
         and zone = v_zone
         and push_sent_at is not null
         and push_sent_at > now() - interval '2 hours'
    ) into v_recent_push;

    if v_confirm >= 3 and v_existing.push_sent_at is null and not v_recent_push then
      v_should_push := true;
    end if;

    update public.road_alerts
       set status_level = case
             when v_level = 'danger' or status_level = 'danger' then 'danger'
             else 'warn'
           end,
           confirm_count = greatest(1, v_confirm),
           clear_count = v_clear,
           updates = v_updates,
           last_confirmed_at = now(),
           expires_at = greatest(expires_at, now() + v_ttl)
     where id = v_existing.id;

    return jsonb_build_object(
      'action', 'merged',
      'alert_id', v_existing.id,
      'confirm_count', greatest(1, v_confirm),
      'should_push', v_should_push
    );
  end if;

  if (
    select count(*) from public.road_alerts
     where reporter_id = v_uid
       and created_at > now() - interval '15 minutes'
  ) >= 4 then
    raise exception 'Túl sok jelzés rövid időn belül — várj pár percet';
  end if;

  insert into public.road_alerts (
    reporter_id,
    category,
    zone,
    status_level,
    message,
    confirm_count,
    clear_count,
    updates,
    last_confirmed_at,
    expires_at
  )
  values (
    v_uid,
    v_cat,
    v_zone,
    v_level,
    v_msg,
    1,
    0,
    '[]'::jsonb,
    now(),
    now() + case when v_level = 'ok' then interval '30 minutes' else v_ttl end
  )
  returning id into v_new_id;

  insert into public.road_alert_votes (alert_id, user_id, vote)
  values (v_new_id, v_uid, 'confirm')
  on conflict (alert_id, user_id) do nothing;

  return jsonb_build_object(
    'action', 'created',
    'alert_id', v_new_id,
    'confirm_count', 1,
    'should_push', false
  );
end;
$$;

create or replace function public.vote_city_alert(
  p_alert_id uuid,
  p_vote text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_alert record;
  v_author text;
  v_confirm int;
  v_clear int;
  v_updates jsonb;
  v_note text := left(trim(coalesce(p_note, '')), 180);
  v_ext interval;
  v_resolved boolean := false;
  v_should_push boolean := false;
  v_recent_push boolean := false;
begin
  if v_uid is null then
    raise exception 'Bejelentkezés szükséges';
  end if;

  if p_vote not in ('confirm', 'clear') then
    raise exception 'Érvénytelen szavazat';
  end if;

  select *
    into v_alert
    from public.road_alerts
   where id = p_alert_id
     and expires_at > now()
   for update;

  if not found then
    raise exception 'Ez a jelzés már lejárt vagy lezárult';
  end if;

  insert into public.road_alert_votes (alert_id, user_id, vote)
  values (p_alert_id, v_uid, p_vote)
  on conflict (alert_id, user_id)
  do update set vote = excluded.vote, created_at = now();

  select
    count(*) filter (where vote = 'confirm'),
    count(*) filter (where vote = 'clear')
    into v_confirm, v_clear
    from public.road_alert_votes
   where alert_id = p_alert_id;

  v_updates := coalesce(v_alert.updates, '[]'::jsonb);
  if char_length(v_note) >= 3 then
    select coalesce(nullif(display_name, ''), 'Helyi lakos')
      into v_author
      from public.profiles
     where id = v_uid;

    v_updates := v_updates || jsonb_build_array(
      jsonb_build_object(
        'text', v_note,
        'author', coalesce(v_author, 'Helyi lakos'),
        'at', now()
      )
    );
  end if;

  if p_vote = 'confirm' then
    v_ext := case v_alert.category
      when 'traffic' then interval '30 minutes'
      when 'transit' then interval '45 minutes'
      when 'utility' then interval '2 hours'
      when 'local'   then interval '3 hours'
      else interval '30 minutes'
    end;

    select exists (
      select 1 from public.road_alerts
       where category = v_alert.category
         and zone = v_alert.zone
         and push_sent_at is not null
         and push_sent_at > now() - interval '2 hours'
    ) into v_recent_push;

    if v_confirm >= 3 and v_alert.push_sent_at is null and not v_recent_push then
      v_should_push := true;
    end if;

    update public.road_alerts
       set confirm_count = greatest(1, v_confirm),
           clear_count = v_clear,
           updates = v_updates,
           last_confirmed_at = now(),
           expires_at = greatest(expires_at, now() + v_ext)
     where id = p_alert_id;
  else
    if v_alert.reporter_id = v_uid
       or v_clear >= 3
       or (v_clear >= 2 and v_alert.last_confirmed_at < now() - interval '5 minutes') then
      v_resolved := true;
      update public.road_alerts
         set confirm_count = v_confirm,
             clear_count = v_clear,
             updates = v_updates,
             expires_at = now()
       where id = p_alert_id;
    else
      update public.road_alerts
         set confirm_count = v_confirm,
             clear_count = v_clear,
             updates = v_updates
       where id = p_alert_id;
    end if;
  end if;

  return jsonb_build_object(
    'alert_id', p_alert_id,
    'confirm_count', v_confirm,
    'clear_count', v_clear,
    'resolved', v_resolved,
    'should_push', v_should_push
  );
end;
$$;

revoke all on function public.submit_city_alert(text, text, text, text) from public;
grant execute on function public.submit_city_alert(text, text, text, text) to authenticated;

revoke all on function public.vote_city_alert(uuid, text, text) from public;
grant execute on function public.vote_city_alert(uuid, text, text) to authenticated;

commit;
