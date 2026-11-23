update public.local_pros
set is_active = false
where id in (
  'c3f746f7-fde2-403d-a467-fcff43e9fa9a',
  '2585b982-ad33-4f3a-a59e-59009ac1db9a'
);

create unique index if not exists profiles_display_name_unique_idx
  on public.profiles (lower(trim(display_name)))
  where display_name is not null and trim(display_name) <> '';

create or replace function public.is_display_name_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles
    where lower(trim(display_name)) = lower(trim(coalesce(p_name, '')))
      and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

revoke all on function public.is_display_name_available(text) from public;
grant execute on function public.is_display_name_available(text) to anon, authenticated;
