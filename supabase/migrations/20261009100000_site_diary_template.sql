-- ============================================================
-- Daily site diary in the AS Construction template layout.
--
-- Adds the template's sections to task_diary_entries (personnel and
-- subcontractor tables, the daily-record fields), a drawn signature from
-- the person recording it, and a "Checked by" sign-off with the
-- checker's drawn signature.
--
-- Existing columns are reused: weather, work_completed, issues (now shown
-- as "Delays and impact"), materials_used, task_label, title.
-- workers_on_site / hours_worked are kept for older entries only.
-- ============================================================

alter table public.task_diary_entries
  add column if not exists working_hours text,
  -- [{ "name", "role", "hours" }]
  add column if not exists personnel jsonb not null default '[]'::jsonb,
  -- [{ "trade", "people", "hours", "work" }]
  add column if not exists subcontractors jsonb not null default '[]'::jsonb,
  add column if not exists materials_delivered text,
  add column if not exists plant_equipment text,
  add column if not exists inspections text,
  add column if not exists instructions text,
  add column if not exists health_safety text,
  add column if not exists visitors text,
  add column if not exists photographs text,
  add column if not exists next_day text,
  -- Drawn signatures, stored as PNG data URLs (small: a few KB each).
  add column if not exists recorder_signature text,
  add column if not exists checked_by uuid references public.profiles(id) on delete set null,
  add column if not exists checked_at timestamptz,
  add column if not exists checker_signature text;

alter table public.task_diary_entries drop constraint if exists task_diary_personnel_is_array;
alter table public.task_diary_entries
  add constraint task_diary_personnel_is_array check (jsonb_typeof(personnel) = 'array');
alter table public.task_diary_entries drop constraint if exists task_diary_subcontractors_is_array;
alter table public.task_diary_entries
  add constraint task_diary_subcontractors_is_array check (jsonb_typeof(subcontractors) = 'array');
alter table public.task_diary_entries drop constraint if exists task_diary_signature_sizes;
alter table public.task_diary_entries
  add constraint task_diary_signature_sizes check (
    coalesce(length(recorder_signature), 0) <= 300000
    and coalesce(length(checker_signature), 0) <= 300000
  );

-- ---- Sign-off ----
-- Only admins / project managers / site supervisors can check an entry,
-- and only through this function: it stamps *their own* profile id and the
-- current time, so a checker can't be impersonated or back-dated.
create or replace function public.sign_off_diary_entry(_entry_id uuid, _signature text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'project_manager')
    or public.has_role(auth.uid(), 'site_supervisor')
  ) then
    raise exception 'Only an admin, project manager or site supervisor can check a diary entry.';
  end if;
  if _signature is null or length(_signature) < 100 then
    raise exception 'A signature is required.';
  end if;

  perform set_config('app.diary_signoff', 'on', true);
  update public.task_diary_entries
     set checked_by = public.current_profile_id(),
         checked_at = now(),
         checker_signature = _signature
   where id = _entry_id;
  if not found then
    raise exception 'Diary entry not found.';
  end if;
end;
$$;

grant execute on function public.sign_off_diary_entry(uuid, text) to authenticated;

-- The author's own UPDATE policy must not let them fill in (or clear) the
-- "checked" fields themselves — those only change via sign_off_diary_entry().
create or replace function public.protect_diary_signoff()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.diary_signoff', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.checked_by is not null or new.checked_at is not null or new.checker_signature is not null then
      raise exception 'A new diary entry cannot be pre-checked.';
    end if;
  elsif new.checked_by is distinct from old.checked_by
     or new.checked_at is distinct from old.checked_at
     or new.checker_signature is distinct from old.checker_signature then
    raise exception 'Use "Sign as checker" to check a diary entry.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_diary_signoff on public.task_diary_entries;
create trigger trg_protect_diary_signoff
  before insert or update on public.task_diary_entries
  for each row execute function public.protect_diary_signoff();

-- Make the changes visible to the app's API immediately.
notify pgrst, 'reload schema';
