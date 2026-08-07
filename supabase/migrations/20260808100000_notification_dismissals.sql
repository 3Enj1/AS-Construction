-- Notifications can be personal (for_user_id) or role broadcasts (for_role),
-- and admins/PMs can see everyone's per the existing read policy — so a hard
-- DELETE on the row would remove it for other recipients too. Instead, track
-- per-user dismissals (same "read pointer" pattern as chat_reads) so anyone
-- can clear a notification from their own list without touching anyone else's.

create table if not exists public.notification_dismissals (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (profile_id, notification_id)
);

alter table public.notification_dismissals enable row level security;

drop policy if exists "Users manage their own dismissals" on public.notification_dismissals;
create policy "Users manage their own dismissals"
on public.notification_dismissals for all to authenticated
using (profile_id = current_profile_id())
with check (profile_id = current_profile_id());
