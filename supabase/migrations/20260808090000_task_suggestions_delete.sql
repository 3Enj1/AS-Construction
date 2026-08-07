-- task_suggestions had select/insert/update policies but no delete policy,
-- so admins/PMs could never actually delete a suggestion (RLS defaults to
-- deny). Needed for the "approve / reject / delete" review flow.
create policy "Admins/PM delete suggestions" on public.task_suggestions
  for delete to authenticated using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
  );
