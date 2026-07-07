
drop policy if exists "Admins/PM insert notifications" on public.notifications;
create policy "Authenticated can create notifications"
on public.notifications for insert to authenticated
with check (true);
