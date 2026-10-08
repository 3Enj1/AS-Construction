-- ============================================================
-- Project-level daily diary. The diary is now filled in per project
-- (from a button on the project page, with a reminder pop-up if today's
-- entry is missing); linking an entry to a specific task is optional.
--
-- Builds on 20261008120000_task_diary_entries.sql: task_id becomes
-- nullable and the write policies are widened from "task assignees" to
-- "anyone on the project team" (still never clients). Written to be safe
-- whether or not that earlier migration has already been applied.
-- ============================================================

create table if not exists public.task_diary_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
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

alter table public.task_diary_entries alter column task_id drop not null;

create index if not exists idx_task_diary_task on public.task_diary_entries(task_id, entry_date desc);
create index if not exists idx_task_diary_project on public.task_diary_entries(project_id, entry_date desc);

drop trigger if exists trg_task_diary_updated on public.task_diary_entries;
create trigger trg_task_diary_updated before update on public.task_diary_entries
  for each row execute function public.set_updated_at();

alter table public.task_diary_entries enable row level security;

-- ---- Read: management roles, or the project team (never clients) ----
drop policy if exists "Elevated read all diary entries" on public.task_diary_entries;
create policy "Elevated read all diary entries" on public.task_diary_entries
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  );
drop policy if exists "Project team read diary entries" on public.task_diary_entries;
create policy "Project team read diary entries" on public.task_diary_entries
  for select to authenticated using (
    public.is_project_member(project_id)
    and not public.has_role(auth.uid(),'client')
  );

-- ---- Write: as yourself, on a project you're on; if a task is linked
-- it must belong to that same project (stops cross-project spoofing) ----
drop policy if exists "Insert own diary entries" on public.task_diary_entries;
create policy "Insert own diary entries" on public.task_diary_entries
  for insert to authenticated with check (
    author_id = public.current_profile_id()
    and not public.has_role(auth.uid(),'client')
    and (
      public.has_role(auth.uid(),'admin')
      or public.has_role(auth.uid(),'project_manager')
      or public.has_role(auth.uid(),'site_supervisor')
      or public.is_project_member(project_id)
    )
    and (
      task_id is null
      or exists (
        select 1 from public.tasks t
        where t.id = task_id and t.project_id = task_diary_entries.project_id
      )
    )
  );

drop policy if exists "Authors update own diary entries" on public.task_diary_entries;
create policy "Authors update own diary entries" on public.task_diary_entries
  for update to authenticated
  using (author_id = public.current_profile_id())
  with check (
    author_id = public.current_profile_id()
    and (
      task_id is null
      or exists (
        select 1 from public.tasks t
        where t.id = task_id and t.project_id = task_diary_entries.project_id
      )
    )
  );

drop policy if exists "Authors or admins delete diary entries" on public.task_diary_entries;
create policy "Authors or admins delete diary entries" on public.task_diary_entries
  for delete to authenticated using (
    author_id = public.current_profile_id()
    or public.has_role(auth.uid(),'admin')
  );

-- Make the change visible to the app's API immediately.
notify pgrst, 'reload schema';
