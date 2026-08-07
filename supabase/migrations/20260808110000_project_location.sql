-- Optional pin location for a project, so completed/active work can be
-- plotted on the project map. Nullable — most existing projects won't have
-- one until an admin sets it via the location picker.
alter table public.projects
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;
