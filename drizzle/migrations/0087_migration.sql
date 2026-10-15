create table public.help_thread_status (
  thread_key text primary key check (thread_key like 'a:%'),
  done_by uuid not null,
  done_at timestamptz not null default now()
);
alter table public.help_thread_status enable row level security;
revoke all on public.help_thread_status from anon, authenticated;
grant all on public.help_thread_status to service_role;

create or replace function public.clear_help_done_on_user_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.thread_key like 'a:%' and new.sender_id::text = substr(new.thread_key, 3) then
    delete from public.help_thread_status where thread_key = new.thread_key;
  end if;
  return new;
end $$;
create trigger trg_clear_help_done after insert on public.marketplace_messages
for each row execute function public.clear_help_done_on_user_message();