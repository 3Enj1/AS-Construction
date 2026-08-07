-- Security hardening pass. See docs/SECURITY_REVIEW.md for the full audit this
-- came from. Each fix below addresses a specific, verified issue — not a
-- speculative one.

-- ============================================================
-- 1. notifications: INSERT policy was `with check (true)` — any
--    authenticated user (including client/worker/subcontractor) could insert
--    an arbitrary notification: any title/body, any kind, any for_user_id
--    (impersonation/targeting) or for_role (broadcast), or both null
--    (org-wide broadcast). Restore to admin/PM only, as originally intended
--    before this was accidentally widened.
-- ============================================================
drop policy if exists "Authenticated can create notifications" on public.notifications;
create policy "Admins/PM create notifications"
on public.notifications for insert to authenticated
with check (
  public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
);

-- ============================================================
-- 2. tasks: "Assignees update own task status" has no column restriction,
--    so a worker/subcontractor can set status='approved'/'rejected' and
--    write approved_by/approved_at/rejection_reason/approval_notes on their
--    own task — self-approving and bypassing the review step entirely.
--    RLS alone can't do column-level checks on UPDATE, so this needs a
--    trigger. Elevated roles are untouched (still governed by their own
--    existing "update any task" policy); this only constrains the
--    self-service assignee path.
-- ============================================================
create or replace function public.prevent_self_task_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  then
    return new;
  end if;

  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    raise exception 'Only an admin, project manager, or site supervisor can approve or reject a task.';
  end if;

  if new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
    or new.approval_notes is distinct from old.approval_notes
    or new.rejection_reason is distinct from old.rejection_reason
  then
    raise exception 'Only an admin, project manager, or site supervisor can set task approval fields.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_self_task_approval on public.tasks;
create trigger trg_prevent_self_task_approval
  before update on public.tasks
  for each row execute function public.prevent_self_task_approval();

-- ============================================================
-- 3. attendance_logs: "Self update own attendance" has no restriction on
--    rewriting historical clock times — a timesheet-fraud vector. Block
--    edits to clock_in/clock_out/break_minutes on shifts that are already
--    completed and more than 24h old, for non-elevated roles. Same-shift
--    corrections (still active, or just completed) remain unrestricted.
-- ============================================================
create or replace function public.prevent_stale_attendance_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  then
    return new;
  end if;

  if old.status = 'completed'
    and old.clock_out is not null
    and old.clock_out < now() - interval '24 hours'
    and (
      new.clock_in is distinct from old.clock_in
      or new.clock_out is distinct from old.clock_out
      or new.break_minutes is distinct from old.break_minutes
    )
  then
    raise exception 'Completed shifts older than 24 hours can only be corrected by an admin, project manager, or site supervisor.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_stale_attendance_edit on public.attendance_logs;
create trigger trg_prevent_stale_attendance_edit
  before update on public.attendance_logs
  for each row execute function public.prevent_stale_attendance_edit();

-- ============================================================
-- 4. profiles: "Authenticated can read active profiles" let every
--    authenticated user (including `client`) read every other user's full
--    row — email, phone, employee_code — with no role gate. Split into:
--    (a) self can read own full row, (b) admin/PM/site_supervisor can read
--    all full rows, (c) a `profile_directory` view exposing only the
--    non-sensitive columns (name/role/avatar/active) broadly, for the
--    existing app-wide "who is this person" UI (chat, assignee pickers,
--    avatars) that never needed email/phone/employee_code.
-- ============================================================
drop policy if exists "Authenticated can read active profiles" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;

create policy "Self read own profile" on public.profiles
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy "Elevated roles read all profiles" on public.profiles
  for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  );

create or replace view public.profile_directory
with (security_invoker = false)
as
select id, full_name, role, avatar_url, is_active, created_at
from public.profiles
where is_active = true and is_archived = false;

grant select on public.profile_directory to authenticated;
