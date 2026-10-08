-- ============================================================
-- Task daily diary: a dated site-diary entry against a task
-- (work done, weather, crew size, hours, issues/delays). Several
-- people can log against the same task on the same day, so there is
-- no one-per-day constraint.
--
-- Internal record: management roles and the project's team can read
-- it, clients cannot (is_project_member() includes the linked client,
-- so the client role is excluded explicitly).
-- ============================================================

create table public.task_diary_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null default current_date,
  work_completed text not null check (length(trim(work_completed)) > 0),
  weather text,
  workers_on_site integer check (workers_on_site is null or workers_on_site >= 0),
  hours_worked numeric check (hours_worked is null or hours_worked >= 0),
  issues text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_task_diary_task on public.task_diary_entries(task_id, entry_date desc);
create index idx_task_diary_project on public.task_diary_entries(project_id, entry_date desc);

create trigger trg_task_diary_updated before update on public.task_diary_entries
  for each row execute function public.set_updated_at();

alter table public.task_diary_entries enable row level security;

create policy "Elevated read all diary entries" on public.task_diary_entries
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  );
create policy "Project team read diary entries" on public.task_diary_entries
  for select to authenticated using (
    public.is_project_member(project_id)
    and not public.has_role(auth.uid(),'client')
  );

-- Write as yourself, against a task you manage or are assigned to, and
-- project_id must be the task's real project (stops cross-project spoofing).
create policy "Insert own diary entries" on public.task_diary_entries
  for insert to authenticated with check (
    author_id = public.current_profile_id()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and t.project_id = task_diary_entries.project_id
        and (
          public.has_role(auth.uid(),'admin')
          or public.has_role(auth.uid(),'project_manager')
          or public.has_role(auth.uid(),'site_supervisor')
          or t.assigned_user_id = public.current_profile_id()
          or t.assigned_supervisor_id = public.current_profile_id()
        )
    )
  );

create policy "Authors update own diary entries" on public.task_diary_entries
  for update to authenticated
  using (author_id = public.current_profile_id())
  with check (
    author_id = public.current_profile_id()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.project_id = task_diary_entries.project_id
    )
  );

create policy "Authors or admins delete diary entries" on public.task_diary_entries
  for delete to authenticated using (
    author_id = public.current_profile_id()
    or public.has_role(auth.uid(),'admin')
  );

-- Make the new table visible to the app's API immediately.
notify pgrst, 'reload schema';
