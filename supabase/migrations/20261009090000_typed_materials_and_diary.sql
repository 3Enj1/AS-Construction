-- ============================================================
-- Typed (free-text) materials + richer daily diary.
--
-- 1. Material requests no longer have to pick from the inventory list:
--    the requester types the material name, quantity and unit. Requests
--    that DO reference an inventory item (material_id) keep the old
--    behaviour (approving deducts stock); typed ones are just a record.
-- 2. Diary entries can list the materials used (what + how many) and a
--    typed task/area, instead of choosing from lists.
-- 3. New material requests now notify admins + project managers from the
--    database. Before, the app inserted that notification itself, which
--    RLS silently blocked for workers — so worker requests notified no one.
-- ============================================================

-- ---- 1. Material requests: typed material ----
alter table public.material_requests alter column material_id drop not null;
alter table public.material_requests
  add column if not exists material_name text,
  add column if not exists unit text;

alter table public.material_requests drop constraint if exists material_requests_has_material;
alter table public.material_requests
  add constraint material_requests_has_material
  check (material_id is not null or length(trim(coalesce(material_name, ''))) > 0);

-- ---- 2. Diary: materials used + typed task/area ----
-- materials_used is a list of { "name": text, "qty": text, "unit": text }.
alter table public.task_diary_entries
  add column if not exists materials_used jsonb not null default '[]'::jsonb,
  add column if not exists task_label text;

alter table public.task_diary_entries drop constraint if exists task_diary_materials_is_array;
alter table public.task_diary_entries
  add constraint task_diary_materials_is_array check (jsonb_typeof(materials_used) = 'array');

-- ---- 3. Notify approvers about every new material request ----
create or replace function public.notify_material_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_unit text;
  v_project text;
  v_body text;
begin
  select coalesce(new.material_name, m.name), coalesce(new.unit, m.unit)
    into v_name, v_unit
    from (select 1) one
    left join public.materials m on m.id = new.material_id;
  select project_name into v_project from public.projects where id = new.project_id;

  v_body := trim(both ' ' from
    coalesce(v_name, 'Material') || ' × ' || new.quantity || ' ' || coalesce(v_unit, '')
  ) || coalesce(' — ' || v_project, '');

  insert into public.notifications (for_role, title, body, kind, link_url)
  select r, case when new.is_urgent then 'Urgent material request' else 'New material request' end,
         v_body, case when new.is_urgent then 'warning' else 'info' end::public.notification_kind,
         '/material-requests'
  from unnest(array['admin', 'project_manager']::public.app_role[]) as r;

  return new;
end;
$$;

drop trigger if exists trg_notify_material_request on public.material_requests;
create trigger trg_notify_material_request
  after insert on public.material_requests
  for each row execute function public.notify_material_request();

-- Make the changes visible to the app's API immediately.
notify pgrst, 'reload schema';
