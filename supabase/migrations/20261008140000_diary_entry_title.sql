-- Diary entries get a short title so the project's Diary tab can list them
-- as "title + date" rows. Nullable: older entries without one fall back to
-- the start of their work_completed text in the app.
alter table public.task_diary_entries add column if not exists title text;

-- Make the change visible to the app's API immediately.
notify pgrst, 'reload schema';
