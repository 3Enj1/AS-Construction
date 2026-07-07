
do $$ begin
  if not exists (select 1 from pg_type where typname='notification_kind') then
    create type public.notification_kind as enum ('info','warning','success','danger');
  end if;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  for_user_id uuid references public.profiles(id) on delete cascade,
  for_role public.app_role,
  title text not null,
  body text,
  kind public.notification_kind not null default 'info',
  link_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_for_user_idx on public.notifications(for_user_id);
create index if not exists notifications_for_role_idx on public.notifications(for_role);

alter table public.notifications enable row level security;

drop policy if exists "Recipients read notifications" on public.notifications;
create policy "Recipients read notifications"
on public.notifications for select to authenticated
using (
  has_role(auth.uid(),'admin')
  or has_role(auth.uid(),'project_manager')
  or (for_user_id is not null and for_user_id = current_profile_id())
  or (for_role is not null and has_role(auth.uid(), for_role))
  or (for_user_id is null and for_role is null)
);

drop policy if exists "Admins/PM insert notifications" on public.notifications;
create policy "Admins/PM insert notifications"
on public.notifications for insert to authenticated
with check (has_role(auth.uid(),'admin') or has_role(auth.uid(),'project_manager'));

drop policy if exists "Recipients mark read" on public.notifications;
create policy "Recipients mark read"
on public.notifications for update to authenticated
using (for_user_id = current_profile_id())
with check (for_user_id = current_profile_id());
