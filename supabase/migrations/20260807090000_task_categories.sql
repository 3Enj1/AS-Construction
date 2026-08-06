-- ============================================================
-- Task trade categories: lets a task be tagged by trade
-- (plumbing, electrical, roofing, etc.) so it can be visually
-- categorised on the task card, same idea as project template
-- categories. Free text (validated in the app), not an enum,
-- so an "other" category never blocks task creation.
-- ============================================================

alter table public.tasks
  add column category text not null default 'general';
