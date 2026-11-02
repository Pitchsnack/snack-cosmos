create table public.user_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_active_at timestamptz not null default now()
);

grant select on public.user_activity to authenticated;
grant all on public.user_activity to service_role;

alter table public.user_activity enable row level security;

create policy "users read only their own activity"
  on public.user_activity for select to authenticated
  using (user_id = auth.uid());

insert into public.user_activity (user_id, last_active_at)
select id, coalesce(last_sign_in_at, created_at) from auth.users
on conflict (user_id) do nothing;

create or replace function public.touch_last_active() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_activity (user_id, last_active_at)
  values (auth.uid(), now())
  on conflict (user_id) do update set last_active_at = now()
  where user_activity.last_active_at < now() - interval '15 minutes';
end $$;

revoke all on function public.touch_last_active() from public, anon;
grant execute on function public.touch_last_active() to authenticated;