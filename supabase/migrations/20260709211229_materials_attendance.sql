-- ============================================================
-- Materials, Material Requests, Attendance/Clock
-- ============================================================

-- ---- ENUMS ----
do $$ begin
  create type public.material_request_status as enum ('pending','approved','denied','delivered');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('active','on_break','completed');
exception when duplicate_object then null; end $$;

-- ---- MATERIALS ----
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unit text not null,
  stock numeric not null default 0,
  threshold numeric not null default 0,
  supplier text,
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_materials_category on public.materials(category);

create trigger trg_materials_updated before update on public.materials
  for each row execute function public.set_updated_at();

alter table public.materials enable row level security;

create policy "Authenticated read materials" on public.materials
  for select to authenticated using (true);
create policy "Admins/PM/Super manage materials" on public.materials
  for all to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  ) with check (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  );

-- ---- MATERIAL REQUESTS ----
create table public.material_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  is_urgent boolean not null default false,
  status public.material_request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_material_requests_project on public.material_requests(project_id);
create index idx_material_requests_status on public.material_requests(status);

alter table public.material_requests enable row level security;

create policy "Elevated read all material requests" on public.material_requests
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  );
create policy "Requesters read own material requests" on public.material_requests
  for select to authenticated using (requested_by = public.current_profile_id());
create policy "Insert own material requests" on public.material_requests
  for insert to authenticated with check (requested_by = public.current_profile_id());
create policy "Admins/PM update material requests" on public.material_requests
  for update to authenticated using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
  ) with check (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
  );

-- ---- ATTENDANCE LOGS ----
create table public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  break_minutes integer not null default 0,
  break_started_at timestamptz,
  status public.attendance_status not null default 'active',
  created_at timestamptz not null default now()
);
create index idx_attendance_profile on public.attendance_logs(profile_id);
create index idx_attendance_status on public.attendance_logs(status);

alter table public.attendance_logs enable row level security;

create policy "Elevated read all attendance" on public.attendance_logs
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  );
create policy "Self read own attendance" on public.attendance_logs
  for select to authenticated using (profile_id = public.current_profile_id());
create policy "Self insert own attendance" on public.attendance_logs
  for insert to authenticated with check (profile_id = public.current_profile_id());
create policy "Self update own attendance" on public.attendance_logs
  for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());
