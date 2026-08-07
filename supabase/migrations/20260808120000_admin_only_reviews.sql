-- Narrow review/approval authority to admins only (was admin+PM). Requesters
-- (PM/site supervisor/workers) keep the ability to raise material requests
-- and suggest tasks — only the approve/deny/delete step is being locked down.

drop policy if exists "Admins/PM update material requests" on public.material_requests;
create policy "Admins update material requests"
on public.material_requests for update to authenticated
using (public.has_role(auth.uid(),'admin'))
with check (public.has_role(auth.uid(),'admin'));

drop policy if exists "Admins/PM review suggestions" on public.task_suggestions;
create policy "Admins review suggestions"
on public.task_suggestions for update to authenticated
using (public.has_role(auth.uid(),'admin'));

drop policy if exists "Admins/PM delete suggestions" on public.task_suggestions;
create policy "Admins delete suggestions"
on public.task_suggestions for delete to authenticated
using (public.has_role(auth.uid(),'admin'));
