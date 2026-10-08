-- All migrations combined in order, for one-shot paste into a NEW Supabase project's SQL Editor.
-- Generated 2026-10-08. Do not run on a database that already has these tables.

-- ================================================================
-- FILE: 20260516162214_94ae3ce4-67c3-465d-8987-90c1ae4ff94a.sql
-- ================================================================

-- ============ ENUM ============
create type public.app_role as enum (
  'admin','project_manager','site_supervisor','worker','subcontractor','client'
);

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  employee_code text not null unique,
  email text not null unique,
  phone text,
  role public.app_role not null default 'worker',
  avatar_url text,
  is_active boolean not null default true,
  has_accepted_terms boolean not null default false,
  accepted_terms_at timestamptz,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role);
create index idx_profiles_employee_code on public.profiles(employee_code);

alter table public.profiles enable row level security;

-- ============ USER_ROLES (separate, anti-escalation) ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

alter table public.user_roles enable row level security;

-- ============ has_role ============
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- ============ updated_at trigger ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ============ handle_new_user trigger ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_code text;
  v_name text;
  v_phone text;
begin
  v_role := coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'worker');
  v_code := coalesce(new.raw_user_meta_data->>'employee_code', 'ASC-TMP-' || substr(new.id::text,1,6));
  v_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
  v_phone := new.raw_user_meta_data->>'phone';

  insert into public.profiles (auth_user_id, full_name, employee_code, email, phone, role)
  values (new.id, v_name, v_code, new.email, v_phone, v_role)
  on conflict (auth_user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, v_role)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ RLS: profiles ============
create policy "Authenticated can read active profiles"
on public.profiles for select
to authenticated
using (is_active = true and is_archived = false);

create policy "Admins can read all profiles"
on public.profiles for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Users can update own profile (limited)"
on public.profiles for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy "Admins can insert profiles"
on public.profiles for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update any profile"
on public.profiles for update
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Allow anonymous lookup of employee_code -> email for login.
-- Restricted to the two columns via a secure RPC below; deny direct anon select.

-- ============ RLS: user_roles ============
create policy "Users can read own roles"
on public.user_roles for select
to authenticated
using (user_id = auth.uid());

create policy "Admins can manage roles"
on public.user_roles for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ============ Public RPC: resolve employee_code -> email ============
create or replace function public.resolve_employee_email(_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.profiles
  where lower(employee_code) = lower(_code)
    and is_active = true
    and is_archived = false
  limit 1
$$;

grant execute on function public.resolve_employee_email(text) to anon, authenticated;

-- ============ Storage buckets ============
insert into storage.buckets (id, name, public) values
  ('profile-avatars','profile-avatars', true),
  ('task-photos','task-photos', false),
  ('project-documents','project-documents', false),
  ('material-receipts','material-receipts', false),
  ('report-exports','report-exports', false)
on conflict (id) do nothing;

-- Avatars: public read, owner upload/update
create policy "Avatars are public"
on storage.objects for select
using (bucket_id = 'profile-avatars');

create policy "Auth can upload avatars"
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-avatars');

create policy "Auth can update avatars"
on storage.objects for update to authenticated
using (bucket_id = 'profile-avatars');

-- Private buckets: authenticated read/upload
create policy "Auth read private buckets"
on storage.objects for select to authenticated
using (bucket_id in ('task-photos','project-documents','material-receipts','report-exports'));

create policy "Auth upload private buckets"
on storage.objects for insert to authenticated
with check (bucket_id in ('task-photos','project-documents','material-receipts','report-exports'));

create policy "Auth update own files"
on storage.objects for update to authenticated
using (bucket_id in ('task-photos','project-documents','material-receipts','report-exports'));

create policy "Admins delete files"
on storage.objects for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));


-- ================================================================
-- FILE: 20260516162242_9a705696-f383-4eff-bd69-cc987edb593a.sql
-- ================================================================

-- harden timestamp helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =================== SEED AUTH USERS ===================
-- Helper to seed one auth user + trigger fills profile via handle_new_user
do $$
declare
  v_uid uuid;
  rec record;
begin
  for rec in
    select * from (values
      ('andrew@asconstruction.test', 'Andrew2026!', 'Andrew Stuart',    'ASC-ADM-001', 'admin',           '+27 82 000 0001'),
      ('pm@asconstruction.test',     'Password123!','Sarah Mitchell',   'ASC-PM-001',  'project_manager', '+27 82 000 0002'),
      ('supervisor@asconstruction.test','Password123!','James Botha',   'ASC-SS-001',  'site_supervisor', '+27 82 000 0003'),
      ('worker@asconstruction.test', 'Password123!','Thabo Nkosi',      'ASC-WRK-001', 'worker',          '+27 82 000 0004'),
      ('sub@asconstruction.test',    'Password123!','RoofPro Subs',     'ASC-SUB-001', 'subcontractor',   '+27 82 000 0005'),
      ('client@asconstruction.test', 'Password123!','Mr & Mrs Patel',   'ASC-CL-001',  'client',          '+27 82 000 0006')
    ) as t(email, pwd, full_name, code, role, phone)
  loop
    -- skip if exists
    if exists (select 1 from auth.users where email = rec.email) then
      continue;
    end if;

    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated', rec.email,
      crypt(rec.pwd, gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',array['email']),
      jsonb_build_object(
        'full_name', rec.full_name,
        'employee_code', rec.code,
        'role', rec.role,
        'phone', rec.phone
      ),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', rec.email),
      'email', v_uid::text, now(), now(), now()
    );
  end loop;
end $$;


-- ================================================================
-- FILE: 20260520203125_99e0a084-60d4-4cc0-bc81-c078823f6b32.sql
-- ================================================================

-- ============================================================
-- Phase 2: Projects, Phases, Tasks, Templates
-- ============================================================

-- ---- ENUMS ----
do $$ begin
  create type public.project_status as enum (
    'planning','active','on_hold','completed','cancelled','archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum (
    'not_started','assigned','in_progress','blocked','awaiting_materials',
    'submitted_for_review','approved','rejected','overdue','archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.priority_level as enum ('low','medium','high','urgent');
exception when duplicate_object then null; end $$;

-- ---- PROJECTS ----
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  client_name text,
  client_contact text,
  client_profile_id uuid references public.profiles(id) on delete set null,
  site_address text,
  description text,
  project_type text,
  status public.project_status not null default 'planning',
  priority public.priority_level not null default 'medium',
  start_date date,
  expected_completion_date date,
  assigned_project_manager_id uuid references public.profiles(id) on delete set null,
  assigned_site_supervisor_id uuid references public.profiles(id) on delete set null,
  permit_approval_status text,
  architect_notes text,
  engineer_notes text,
  quantity_surveyor_notes text,
  subcontractor_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_projects_status on public.projects(status) where is_archived = false;
create index idx_projects_pm on public.projects(assigned_project_manager_id);
create index idx_projects_super on public.projects(assigned_site_supervisor_id);
create index idx_projects_client on public.projects(client_profile_id);

-- ---- PROJECT PHASES ----
create table public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_name text not null,
  description text,
  sort_order integer not null default 0,
  status text not null default 'pending',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_project_phases_project on public.project_phases(project_id);

-- ---- TASKS ----
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_id uuid references public.project_phases(id) on delete set null,
  task_title text not null,
  description text,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  assigned_supervisor_id uuid references public.profiles(id) on delete set null,
  status public.task_status not null default 'not_started',
  priority public.priority_level not null default 'medium',
  due_date date,
  created_by uuid references public.profiles(id) on delete set null,
  submitted_for_review_at timestamptz,
  completed_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  approval_notes text,
  rejection_reason text,
  client_visible boolean not null default false,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_project on public.tasks(project_id);
create index idx_tasks_phase on public.tasks(phase_id);
create index idx_tasks_assigned on public.tasks(assigned_user_id);
create index idx_tasks_status on public.tasks(status);

-- ---- TASK UPDATES ----
create table public.task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  update_type text not null default 'note',
  note text,
  created_at timestamptz not null default now()
);
create index idx_task_updates_task on public.task_updates(task_id);

-- ---- TASK PHOTOS ----
create table public.task_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  file_url text not null,
  file_type text,
  upload_category text default 'progress',
  note text,
  created_at timestamptz not null default now()
);
create index idx_task_photos_task on public.task_photos(task_id);

-- ---- TASK SUGGESTIONS ----
create table public.task_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  suggested_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  urgency public.priority_level default 'medium',
  photo_url text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_comment text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---- TASK COMMENTS ----
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  attachment_url text,
  created_at timestamptz not null default now()
);
create index idx_task_comments_task on public.task_comments(task_id);

-- ---- TEMPLATES ----
create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  project_template_id uuid not null references public.project_templates(id) on delete cascade,
  phase_name text not null,
  phase_description text,
  task_title text not null,
  task_description text,
  sort_order integer not null default 0,
  default_priority public.priority_level not null default 'medium',
  estimated_duration_days integer,
  created_at timestamptz not null default now()
);
create index idx_task_templates_tmpl on public.task_templates(project_template_id, sort_order);

-- ---- updated_at triggers ----
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();
create trigger trg_phases_updated before update on public.project_phases
  for each row execute function public.set_updated_at();
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger trg_tmpl_updated before update on public.project_templates
  for each row execute function public.set_updated_at();

-- ---- Helper: profile id for current auth user ----
create or replace function public.current_profile_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

-- ---- Helper: is user assigned to project (via task or as PM/super/client) ----
create or replace function public.is_project_member(_project_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  with me as (select public.current_profile_id() as pid)
  select exists(
    select 1 from public.projects p, me
    where p.id = _project_id
      and (p.assigned_project_manager_id = me.pid
        or p.assigned_site_supervisor_id = me.pid
        or p.client_profile_id = me.pid)
  ) or exists(
    select 1 from public.tasks t, me
    where t.project_id = _project_id and t.assigned_user_id = me.pid
  );
$$;

-- =====================================================
-- RLS
-- =====================================================
alter table public.projects enable row level security;
alter table public.project_phases enable row level security;
alter table public.tasks enable row level security;
alter table public.task_updates enable row level security;
alter table public.task_photos enable row level security;
alter table public.task_suggestions enable row level security;
alter table public.task_comments enable row level security;
alter table public.project_templates enable row level security;
alter table public.task_templates enable row level security;

-- ---- PROJECTS ----
create policy "Admins/PM full read projects" on public.projects
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  );
create policy "Project members read" on public.projects
  for select to authenticated using (public.is_project_member(id));
create policy "Admins/PM insert projects" on public.projects
  for insert to authenticated with check (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
  );
create policy "Admins/PM update projects" on public.projects
  for update to authenticated using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
  );

-- ---- PHASES ----
create policy "Read phases if project visible" on public.project_phases
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
    or public.is_project_member(project_id)
  );
create policy "Admins/PM manage phases" on public.project_phases
  for all to authenticated using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
  ) with check (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
  );

-- ---- TASKS ----
create policy "Admins/PM/Super read all tasks" on public.tasks
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  );
create policy "Assignees read own tasks" on public.tasks
  for select to authenticated using (
    assigned_user_id = public.current_profile_id()
    or assigned_supervisor_id = public.current_profile_id()
  );
create policy "Clients read visible tasks" on public.tasks
  for select to authenticated using (
    client_visible = true and exists(
      select 1 from public.projects p
      where p.id = tasks.project_id
        and p.client_profile_id = public.current_profile_id()
    )
  );
create policy "Admins/PM insert tasks" on public.tasks
  for insert to authenticated with check (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
  );
create policy "Admins/PM/Super update any task" on public.tasks
  for update to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  );
create policy "Assignees update own task status" on public.tasks
  for update to authenticated
  using (assigned_user_id = public.current_profile_id())
  with check (assigned_user_id = public.current_profile_id());

-- ---- TASK UPDATES ----
create policy "Read updates if can read task" on public.task_updates
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
    or exists (select 1 from public.tasks t where t.id = task_id and t.assigned_user_id = public.current_profile_id())
  );
create policy "Authors insert updates" on public.task_updates
  for insert to authenticated with check (user_id = public.current_profile_id());

-- ---- TASK PHOTOS ----
create policy "Read photos if can read project" on public.task_photos
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
    or public.is_project_member(project_id)
  );
create policy "Uploaders insert photos" on public.task_photos
  for insert to authenticated with check (uploaded_by = public.current_profile_id());

-- ---- TASK SUGGESTIONS ----
create policy "Read suggestions admins/pm/super" on public.task_suggestions
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
    or suggested_by = public.current_profile_id()
  );
create policy "Insert own suggestions" on public.task_suggestions
  for insert to authenticated with check (suggested_by = public.current_profile_id());
create policy "Admins/PM review suggestions" on public.task_suggestions
  for update to authenticated using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
  );

-- ---- TASK COMMENTS ----
create policy "Read comments if project visible" on public.task_comments
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
    or public.is_project_member(project_id)
  );
create policy "Insert own comments" on public.task_comments
  for insert to authenticated with check (sender_id = public.current_profile_id());

-- ---- TEMPLATES ----
create policy "All authenticated read templates" on public.project_templates
  for select to authenticated using (true);
create policy "Admins manage templates" on public.project_templates
  for all to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

create policy "All authenticated read task templates" on public.task_templates
  for select to authenticated using (true);
create policy "Admins manage task templates" on public.task_templates
  for all to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- =====================================================
-- SEED: default template "New Residential Home Build"
-- =====================================================
do $$
declare
  v_tmpl uuid;
begin
  insert into public.project_templates (template_name, description, is_active)
  values ('New Residential Home Build',
          'Standard 9-phase residential build template covering planning to handover.',
          true)
  returning id into v_tmpl;

  insert into public.task_templates
    (project_template_id, phase_name, phase_description, task_title, task_description, sort_order, default_priority, estimated_duration_days)
  values
    -- 1. Planning & Approvals
    (v_tmpl,'Planning & Approvals','Permits, approvals & pre-construction docs','Confirm architectural drawings','Sign off final architectural set with client.',10,'high',3),
    (v_tmpl,'Planning & Approvals',null,'Submit municipal building plans','Lodge plans with local authority for approval.',20,'high',14),
    (v_tmpl,'Planning & Approvals',null,'Engineer structural sign-off','Get engineer-stamped structural drawings.',30,'high',5),
    (v_tmpl,'Planning & Approvals',null,'Quantity surveyor cost report','BOQ and cost plan from QS.',40,'medium',5),
    -- 2. Site Preparation
    (v_tmpl,'Site Preparation','Clear & prep site','Site clearance & vegetation removal','Strip topsoil and clear obstructions.',10,'medium',2),
    (v_tmpl,'Site Preparation',null,'Set out site boundaries','Surveyor pegs and string lines.',20,'medium',1),
    (v_tmpl,'Site Preparation',null,'Install site fencing & signage','Hoarding and safety signage.',30,'medium',1),
    -- 3. Foundations
    (v_tmpl,'Foundations','Excavation & footings','Excavate foundation trenches','Per engineer drawings.',10,'high',3),
    (v_tmpl,'Foundations',null,'Place reinforcement & inspection','Rebar cages, council inspection.',20,'high',2),
    (v_tmpl,'Foundations',null,'Pour foundation concrete','Schedule mixer trucks, cure.',30,'high',2),
    -- 4. Structure / Brickwork
    (v_tmpl,'Structure / Brickwork','Walls & superstructure','Build external walls to wall plate','Cavity brickwork up to roof level.',10,'high',15),
    (v_tmpl,'Structure / Brickwork',null,'Install lintels and openings','Door/window frames and lintels.',20,'medium',3),
    (v_tmpl,'Structure / Brickwork',null,'Internal partition walls','Block/stud walls per layout.',30,'medium',7),
    -- 5. Roofing
    (v_tmpl,'Roofing','Trusses, sheeting & waterproofing','Install roof trusses','Crane in trusses, brace and fix.',10,'high',3),
    (v_tmpl,'Roofing',null,'Roof sheeting / tiling','Underlay and final cover.',20,'high',4),
    (v_tmpl,'Roofing',null,'Gutters and downpipes','Fascia, gutters, leaf guards.',30,'medium',2),
    -- 6. Plumbing & Electrical Coordination
    (v_tmpl,'Plumbing & Electrical Coordination','First-fix MEP','First-fix plumbing rough-in','Hot/cold pipes, drains chased in.',10,'high',5),
    (v_tmpl,'Plumbing & Electrical Coordination',null,'First-fix electrical wiring','Conduit and cable pulls.',20,'high',5),
    (v_tmpl,'Plumbing & Electrical Coordination',null,'HVAC / geyser positioning','Brackets and rough connections.',30,'medium',2),
    -- 7. Plastering & Finishes
    (v_tmpl,'Plastering & Finishes','Wet trades and finishes','Internal plastering','Skim coat all internal walls.',10,'medium',7),
    (v_tmpl,'Plastering & Finishes',null,'Tiling - bathrooms & kitchen','Wall and floor tiling.',20,'medium',7),
    (v_tmpl,'Plastering & Finishes',null,'Painting - undercoat & finish','Two coats internal & external.',30,'medium',5),
    (v_tmpl,'Plastering & Finishes',null,'Install kitchen & built-ins','Cabinetry, countertops.',40,'medium',4),
    -- 8. Snagging & Quality Check
    (v_tmpl,'Snagging & Quality Check','Defects list & rectification','Walk-through snag list','PM + supervisor compile defects list.',10,'high',1),
    (v_tmpl,'Snagging & Quality Check',null,'Rectify snags','Trades return to fix listed items.',20,'high',5),
    (v_tmpl,'Snagging & Quality Check',null,'Final clean','Builder''s clean inside and out.',30,'medium',2),
    -- 9. Final Handover
    (v_tmpl,'Final Handover','Documents & keys to client','Compile handover pack','Manuals, warranties, as-built drawings.',10,'high',2),
    (v_tmpl,'Final Handover',null,'Client walk-through & sign-off','Demonstrate systems, get sign-off.',20,'high',1),
    (v_tmpl,'Final Handover',null,'Hand over keys','Issue keys, close out project.',30,'high',1);
end $$;


-- ================================================================
-- FILE: 20260520205104_ba0b8d3f-2f73-48a3-9a8d-685dd4c5cf37.sql
-- ================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname='notification_kind') then
    create type public.notification_kind as enum ('info','warning','success','danger');
  end if;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  for_user_id uuid references public.profiles(id) on delete cascade,
  for_role public.app_role,
  title text not null,
  body text,
  kind public.notification_kind not null default 'info',
  link_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_for_user_idx on public.notifications(for_user_id);
create index if not exists notifications_for_role_idx on public.notifications(for_role);

alter table public.notifications enable row level security;

drop policy if exists "Recipients read notifications" on public.notifications;
create policy "Recipients read notifications"
on public.notifications for select to authenticated
using (
  has_role(auth.uid(),'admin')
  or has_role(auth.uid(),'project_manager')
  or (for_user_id is not null and for_user_id = current_profile_id())
  or (for_role is not null and has_role(auth.uid(), for_role))
  or (for_user_id is null and for_role is null)
);

drop policy if exists "Admins/PM insert notifications" on public.notifications;
create policy "Admins/PM insert notifications"
on public.notifications for insert to authenticated
with check (has_role(auth.uid(),'admin') or has_role(auth.uid(),'project_manager'));

drop policy if exists "Recipients mark read" on public.notifications;
create policy "Recipients mark read"
on public.notifications for update to authenticated
using (for_user_id = current_profile_id())
with check (for_user_id = current_profile_id());


-- ================================================================
-- FILE: 20260520205725_b6c2d0a5-3d6c-48ee-9564-a193da91cfcb.sql
-- ================================================================

drop policy if exists "Admins/PM insert notifications" on public.notifications;
create policy "Authenticated can create notifications"
on public.notifications for insert to authenticated
with check (true);


-- ================================================================
-- FILE: 20260709211229_materials_attendance.sql
-- ================================================================
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


-- ================================================================
-- FILE: 20260710000812_chat_messages.sql
-- ================================================================
-- ============================================================
-- Project chat
-- ============================================================

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);
create index idx_chat_messages_project on public.chat_messages(project_id, created_at);

alter table public.chat_messages enable row level security;

create policy "Read messages if project visible" on public.chat_messages
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
    or public.is_project_member(project_id)
  );

create policy "Insert own messages if project visible" on public.chat_messages
  for insert to authenticated with check (
    sender_id = public.current_profile_id()
    and (
      public.has_role(auth.uid(),'admin')
      or public.has_role(auth.uid(),'project_manager')
      or public.has_role(auth.uid(),'site_supervisor')
      or public.is_project_member(project_id)
    )
  );

alter publication supabase_realtime add table public.chat_messages;


-- ================================================================
-- FILE: 20260710004237_template_categories_and_seed.sql
-- ================================================================
-- ============================================================
-- Template categories + 5 additional sample project templates
-- ============================================================

alter table public.project_templates add column category text not null default 'general';

update public.project_templates set category = 'residential_build' where template_name = 'New Residential Home Build';

do $$
declare
  v_tmpl uuid;
begin
  -- ==================== Home Renovation / Remodel ====================
  insert into public.project_templates (template_name, description, category, is_active)
  values ('Home Renovation / Remodel', 'Whole-house renovation covering strip-out through to finishes and handover.', 'renovation', true)
  returning id into v_tmpl;

  insert into public.task_templates
    (project_template_id, phase_name, phase_description, task_title, task_description, sort_order, default_priority, estimated_duration_days)
  values
    (v_tmpl,'Planning & Permits','Scope, surveys and approvals','Confirm renovation scope with client','Walk the property and agree final scope of works.',10,'high',3),
    (v_tmpl,'Planning & Permits',null,'Submit renovation permit application','Lodge plans with local authority where required.',20,'high',10),
    (v_tmpl,'Planning & Permits',null,'Asbestos / lead survey','Required for pre-2000 builds before demolition starts.',30,'high',3),
    (v_tmpl,'Demolition & Strip-out','Clear the space','Strip out fixtures and finishes','Remove existing joinery, flooring and fittings.',10,'medium',3),
    (v_tmpl,'Demolition & Strip-out',null,'Remove non-structural walls','Per approved drawings only.',20,'medium',2),
    (v_tmpl,'Demolition & Strip-out',null,'Skip / waste removal','Schedule skips for demolition waste.',30,'low',1),
    (v_tmpl,'Structural & Rough-ins','Rebuild the bones','Structural alterations per engineer','Beams, lintels and load-bearing changes.',10,'high',5),
    (v_tmpl,'Structural & Rough-ins',null,'First-fix electrical rewiring','New circuits, consumer unit if needed.',20,'high',4),
    (v_tmpl,'Structural & Rough-ins',null,'First-fix plumbing rework','Reroute supply and waste for new layout.',30,'high',4),
    (v_tmpl,'Finishes','Walls, floors, paint','Plastering and skim coats','All affected walls and ceilings.',10,'medium',5),
    (v_tmpl,'Finishes',null,'Flooring installation','Per room finish schedule.',20,'medium',4),
    (v_tmpl,'Finishes',null,'Painting internal & external','Two coats, all affected surfaces.',30,'medium',5),
    (v_tmpl,'Fixtures & Fittings','Kit the space out','Kitchen and bathroom fit-out','Install cabinetry and sanitaryware.',10,'medium',5),
    (v_tmpl,'Fixtures & Fittings',null,'Doors and ironmongery','Hang doors, fit handles and locks.',20,'low',2),
    (v_tmpl,'Fixtures & Fittings',null,'Light fittings and switches','Final fix electrical.',30,'low',2),
    (v_tmpl,'Handover','Sign-off','Snag list walk-through','Compile defects list with client.',10,'high',1),
    (v_tmpl,'Handover',null,'Final clean','Builder''s clean throughout.',20,'medium',1),
    (v_tmpl,'Handover',null,'Handover documentation to client','Warranties, manuals, as-built notes.',30,'medium',1);

  -- ==================== Kitchen & Bathroom Remodel ====================
  insert into public.project_templates (template_name, description, category, is_active)
  values ('Kitchen & Bathroom Remodel', 'Focused wet-room and kitchen remodel from design through installation.', 'kitchen_bath', true)
  returning id into v_tmpl;

  insert into public.task_templates
    (project_template_id, phase_name, phase_description, task_title, task_description, sort_order, default_priority, estimated_duration_days)
  values
    (v_tmpl,'Design & Ordering','Lock in the plan','Finalise layout and material selections','Client sign-off on layout, finishes and appliances.',10,'high',5),
    (v_tmpl,'Design & Ordering',null,'Order cabinetry and worktops','Long lead item — order early.',20,'high',2),
    (v_tmpl,'Design & Ordering',null,'Order sanitaryware and tiles','Confirm quantities against final layout.',30,'medium',2),
    (v_tmpl,'Strip-out','Clear existing','Remove existing units and fittings','Kitchen units or bathroom suite removal.',10,'medium',2),
    (v_tmpl,'Strip-out',null,'Disconnect plumbing and electrical','Isolate supplies safely before works begin.',20,'high',1),
    (v_tmpl,'First-fix','Behind the walls','Reroute plumbing for new layout','Supply and waste to new fixture positions.',10,'high',3),
    (v_tmpl,'First-fix',null,'First-fix electrical for appliances/lighting','Circuits for new appliances and lighting layout.',20,'high',2),
    (v_tmpl,'First-fix',null,'Waterproofing (wet areas)','Tanking to shower and wet-wall zones.',30,'high',2),
    (v_tmpl,'Tiling & Surfaces','Hard finishes','Wall and floor tiling','Per selected tile schedule.',10,'medium',4),
    (v_tmpl,'Tiling & Surfaces',null,'Install worktops / countertops','Template and fit.',20,'medium',2),
    (v_tmpl,'Installation','Fit it out','Install cabinetry and units','Kitchen or vanity units.',10,'medium',3),
    (v_tmpl,'Installation',null,'Install sanitaryware and taps','Bath, basin, WC, mixers.',20,'medium',2),
    (v_tmpl,'Installation',null,'Install appliances','Hob, oven, extractor, dishwasher etc.',30,'low',1),
    (v_tmpl,'Finishing','Final details','Grouting and sealant','All tiled areas and wet joints.',10,'low',1),
    (v_tmpl,'Finishing',null,'Final electrical connections','Test and commission all circuits.',20,'medium',1),
    (v_tmpl,'Finishing',null,'Client walkthrough','Demonstrate fixtures, confirm sign-off.',30,'medium',1);

  -- ==================== Roof Replacement ====================
  insert into public.project_templates (template_name, description, category, is_active)
  values ('Roof Replacement', 'Full re-roof from survey through to final weatherproofing and clean-up.', 'roofing', true)
  returning id into v_tmpl;

  insert into public.task_templates
    (project_template_id, phase_name, phase_description, task_title, task_description, sort_order, default_priority, estimated_duration_days)
  values
    (v_tmpl,'Survey & Materials','Plan the job','Roof survey and photos','Document existing condition and take measurements.',10,'high',1),
    (v_tmpl,'Survey & Materials',null,'Order roofing materials','Tiles/sheeting, underlay, battens.',20,'high',5),
    (v_tmpl,'Survey & Materials',null,'Schedule scaffold / access','Book scaffold erection ahead of start.',30,'medium',3),
    (v_tmpl,'Strip-off','Access & removal','Erect scaffolding and edge protection','Safe access for the full roof area.',10,'high',2),
    (v_tmpl,'Strip-off',null,'Strip old roof covering','Remove existing tiles/sheeting down to structure.',20,'high',2),
    (v_tmpl,'Strip-off',null,'Skip for waste removal','Arrange skip for stripped materials.',30,'low',1),
    (v_tmpl,'Structural Repairs','Fix what''s underneath','Inspect and repair timber structure','Replace any rotten or damaged rafters/trusses.',10,'high',3),
    (v_tmpl,'Structural Repairs',null,'Replace damaged battens / felt','Prep surface for new covering.',20,'medium',2),
    (v_tmpl,'Covering','Weatherproof it','Install new underlay and battens','Full roof area.',10,'high',2),
    (v_tmpl,'Covering',null,'Install tiles / sheeting','Per selected roofing material.',20,'high',4),
    (v_tmpl,'Covering',null,'Install ridge and hip tiles','Cap the roof.',30,'medium',1),
    (v_tmpl,'Finishing','Details & handover','Install gutters and downpipes','New or reinstated rainwater goods.',10,'medium',2),
    (v_tmpl,'Finishing',null,'Flashing and weatherproofing details','Chimneys, valleys and abutments.',20,'high',2),
    (v_tmpl,'Finishing',null,'Final inspection and clean-up','Remove scaffold, site clean, sign-off.',30,'medium',1);

  -- ==================== Commercial Fit-Out / Tenant Improvement ====================
  insert into public.project_templates (template_name, description, category, is_active)
  values ('Commercial Fit-Out', 'Tenant improvement fit-out from design approval through MEP commissioning.', 'commercial', true)
  returning id into v_tmpl;

  insert into public.task_templates
    (project_template_id, phase_name, phase_description, task_title, task_description, sort_order, default_priority, estimated_duration_days)
  values
    (v_tmpl,'Design & Approvals','Get the green light','Space plan sign-off with tenant','Confirm layout, finishes and fixed furniture.',10,'high',5),
    (v_tmpl,'Design & Approvals',null,'Landlord / council approvals','Building consent and landlord fit-out approval.',20,'high',10),
    (v_tmpl,'Design & Approvals',null,'Order long-lead materials','Glazing, joinery, specialist finishes.',30,'medium',3),
    (v_tmpl,'Strip-out & Prep','Clear the shell','Strip out existing fit-out','Remove prior tenant''s fixtures and partitions.',10,'medium',3),
    (v_tmpl,'Strip-out & Prep',null,'Protect base building finishes','Protect lifts, lobbies and shared areas.',20,'low',1),
    (v_tmpl,'MEP First-fix','Behind the ceiling','Electrical first-fix and containment','Cable containment and rough wiring.',10,'high',4),
    (v_tmpl,'MEP First-fix',null,'HVAC ductwork installation','Distribution to new layout.',20,'high',5),
    (v_tmpl,'MEP First-fix',null,'Fire and life-safety rough-in','Sprinklers, alarms, emergency lighting first-fix.',30,'high',4),
    (v_tmpl,'Partitioning & Ceilings','Build the rooms','Stud partition walls','Per approved space plan.',10,'medium',4),
    (v_tmpl,'Partitioning & Ceilings',null,'Suspended ceiling grid and tiles','Full floor area.',20,'medium',3),
    (v_tmpl,'Partitioning & Ceilings',null,'Glazed partitions / doors','Meeting rooms and offices.',30,'medium',3),
    (v_tmpl,'Finishes & Fit-out','Make it usable','Flooring installation','Carpet tile / LVT per schedule.',10,'medium',3),
    (v_tmpl,'Finishes & Fit-out',null,'Paint and wall finishes','All partitions and exposed walls.',20,'medium',3),
    (v_tmpl,'Finishes & Fit-out',null,'Joinery and fixed furniture','Reception desks, kitchenette units, storage.',30,'low',4),
    (v_tmpl,'Commissioning','Prove it works','MEP commissioning and testing','Test and balance all building services.',10,'high',3),
    (v_tmpl,'Commissioning',null,'Fire certification','Sign-off from fire authority.',20,'high',2),
    (v_tmpl,'Commissioning',null,'Client handover and snagging','Walkthrough, punch list, keys handover.',30,'medium',2);

  -- ==================== Home Extension / Addition ====================
  insert into public.project_templates (template_name, description, category, is_active)
  values ('Home Extension / Addition', 'Single-storey extension from planning through to connecting services with the existing house.', 'extension', true)
  returning id into v_tmpl;

  insert into public.task_templates
    (project_template_id, phase_name, phase_description, task_title, task_description, sort_order, default_priority, estimated_duration_days)
  values
    (v_tmpl,'Planning & Permits','Get approved','Architectural drawings sign-off','Client sign-off on final design.',10,'high',5),
    (v_tmpl,'Planning & Permits',null,'Submit building plans for approval','Lodge with local authority.',20,'high',14),
    (v_tmpl,'Planning & Permits',null,'Engineer structural drawings','Foundation and structural design.',30,'high',5),
    (v_tmpl,'Groundworks & Foundations','Get below ground','Excavate foundations','Per engineer''s drawings.',10,'high',3),
    (v_tmpl,'Groundworks & Foundations',null,'Reinforcement and council inspection','Rebar cage and building control sign-off.',20,'high',2),
    (v_tmpl,'Groundworks & Foundations',null,'Pour foundation concrete','Schedule concrete delivery, allow cure time.',30,'high',3),
    (v_tmpl,'Structure','Build up','Build extension walls to wall plate','Blockwork/brickwork to roof level.',10,'high',10),
    (v_tmpl,'Structure',null,'Install steel beams / lintels','Structural openings per engineer.',20,'high',2),
    (v_tmpl,'Structure',null,'Roof structure and covering','Trusses/rafters and roof covering.',30,'high',5),
    (v_tmpl,'Envelope','Weathertight','Windows and external doors','Install per schedule.',10,'medium',3),
    (v_tmpl,'Envelope',null,'External render / cladding','Finish external walls.',20,'medium',5),
    (v_tmpl,'Envelope',null,'Weatherproofing','Seal all external junctions.',30,'medium',2),
    (v_tmpl,'Internal Fit-out','Inside works','First-fix electrical and plumbing','Rough-in for new space.',10,'high',4),
    (v_tmpl,'Internal Fit-out',null,'Plastering','Walls and ceilings throughout.',20,'medium',4),
    (v_tmpl,'Internal Fit-out',null,'Flooring and internal doors','Per finish schedule.',30,'medium',3),
    (v_tmpl,'Finishing','Wrap up','Painting and decorating','Two coats, all surfaces.',10,'medium',4),
    (v_tmpl,'Finishing',null,'Final fix electrical and plumbing','Sockets, switches, sanitaryware.',20,'medium',2),
    (v_tmpl,'Finishing',null,'Connect extension to existing house','Tie in services and open up connecting wall.',30,'high',2);
end $$;


-- ================================================================
-- FILE: 20260713120000_material_transactions.sql
-- ================================================================
-- ============================================================
-- Materials transaction ledger
-- materials.stock becomes a derived value: only this trigger writes
-- it, in response to inserts into material_transactions. Client code
-- must never write materials.stock directly.
-- ============================================================

-- ---- ENUM ----
do $$ begin
  create type public.material_transaction_type as enum ('delivery','usage','adjustment');
exception when duplicate_object then null; end $$;

-- ---- TABLE ----
create table public.material_transactions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  qty_delta numeric not null check (qty_delta <> 0),
  type public.material_transaction_type not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint material_transactions_sign_matches_type check (
    (type = 'delivery' and qty_delta > 0) or
    (type = 'usage' and qty_delta < 0) or
    (type = 'adjustment')
  )
);
create index idx_material_transactions_material on public.material_transactions(material_id);
create index idx_material_transactions_project on public.material_transactions(project_id);
create index idx_material_transactions_task on public.material_transactions(task_id);

-- ---- Defense in depth: stock can never go negative ----
alter table public.materials add constraint materials_stock_nonneg check (stock >= 0);

-- ---- Backfill: one opening adjustment per existing material, run
-- before the trigger exists below so it cannot double-apply. ----
insert into public.material_transactions (material_id, qty_delta, type, note, created_by, created_at)
select id, stock, 'adjustment', 'Opening balance (migration backfill)', null, now()
from public.materials
where stock <> 0;

-- ---- Trigger: apply the delta atomically, reject if it would go
-- negative, and raise a low-stock notification on threshold-crossing. ----
create or replace function public.apply_material_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_stock numeric;
  v_old_stock numeric;
  v_threshold numeric;
  v_name text;
begin
  update public.materials
     set stock = stock + new.qty_delta
   where id = new.material_id
     and stock + new.qty_delta >= 0
  returning stock, threshold, name into v_new_stock, v_threshold, v_name;

  if not found then
    raise exception 'Insufficient stock for material % (requested delta %)', new.material_id, new.qty_delta
      using errcode = '23514';
  end if;

  v_old_stock := v_new_stock - new.qty_delta;

  if v_old_stock >= v_threshold and v_new_stock < v_threshold then
    insert into public.notifications (for_role, title, body, kind, link_url)
    values (
      'admin',
      'Low stock: ' || v_name,
      v_name || ' dropped to ' || v_new_stock || ' (threshold ' || v_threshold || ').',
      'warning',
      '/materials'
    );
  end if;

  return new;
end;
$$;

create trigger trg_material_transactions_apply
  after insert on public.material_transactions
  for each row execute function public.apply_material_transaction();

-- ---- RLS: append-only ledger, no update/delete policies at all ----
alter table public.material_transactions enable row level security;

create policy "Elevated read all material transactions" on public.material_transactions
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  );
create policy "Project members read their project transactions" on public.material_transactions
  for select to authenticated using (
    project_id is not null and public.is_project_member(project_id)
  );

create policy "Admins/PM/Super insert any transaction" on public.material_transactions
  for insert to authenticated with check (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  );
create policy "Assignees insert usage on own task" on public.material_transactions
  for insert to authenticated with check (
    type = 'usage'
    and created_by = public.current_profile_id()
    and task_id is not null
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.assigned_user_id = public.current_profile_id()
    )
  );


-- ================================================================
-- FILE: 20260731090000_project_budget.sql
-- ================================================================
-- ============================================================
-- Minimal budget tracking: a single budget figure per project,
-- plus a manually-logged expense ledger for "actuals". Deliberately
-- simple — no line-item estimates, no tie-in to material costs yet.
-- ============================================================

alter table public.projects add column if not exists budget numeric;

create table public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  amount numeric not null check (amount > 0),
  category text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_project_expenses_project on public.project_expenses(project_id);

alter table public.project_expenses enable row level security;

-- Financial detail: management roles only (not the general project-member
-- expansion used elsewhere) — workers/clients don't see cost line items.
create policy "Admins/PM/Super read expenses" on public.project_expenses
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
  );
create policy "Admins/PM insert expenses" on public.project_expenses
  for insert to authenticated with check (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
  );
create policy "Admins/PM delete expenses" on public.project_expenses
  for delete to authenticated using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
  );


-- ================================================================
-- FILE: 20260801090000_materials_realtime.sql
-- ================================================================
-- Live stock updates on the Materials page: broadcast INSERT/UPDATE/DELETE
-- on materials so every open session sees stock changes immediately,
-- matching the existing chat_messages realtime pattern.
alter publication supabase_realtime add table public.materials;


-- ================================================================
-- FILE: 20260802090000_stock_alert_webhook.sql
-- ================================================================
-- ============================================================
-- Stock alert notifications: email + WhatsApp to the admin whenever
-- a material crosses its low-stock threshold, in either direction
-- (drops below = low stock, comes back up = restocked).
--
-- Extends apply_material_transaction() (the existing materials
-- ledger trigger) instead of adding a second trigger, so old/new
-- stock are read from the same atomic update. The in-app
-- `notifications` row (already existed for low stock) is kept as-is;
-- this adds a fire-and-forget HTTP call to a Supabase Edge Function
-- (see supabase/functions/notify-stock-alert) which sends the actual
-- email + WhatsApp message. net.http_post is async (queues the
-- request via pg_net) so a slow/down notification service can never
-- block or fail a stock transaction.
-- ============================================================

create extension if not exists pg_net with schema extensions;

create or replace function public.apply_material_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_stock numeric;
  v_old_stock numeric;
  v_threshold numeric;
  v_name text;
  v_unit text;
  -- Deployed Edge Function URL for this project + a shared secret it
  -- checks on every request (set the same value as the
  -- WEBHOOK_SHARED_SECRET function secret — see deployment notes).
  -- EDITED for a new project: originally pointed at the old project
  -- (iwrwhhglagzsvvgpsuop). Replace YOUR-PROJECT-ID and set your own
  -- secret once notify-stock-alert is deployed to your project. Until
  -- then the call just fails silently; stock updates still work.
  v_webhook_url text := 'https://YOUR-PROJECT-ID.supabase.co/functions/v1/notify-stock-alert';
  v_webhook_secret text := 'CHANGE-ME';
begin
  update public.materials
     set stock = stock + new.qty_delta
   where id = new.material_id
     and stock + new.qty_delta >= 0
  returning stock, threshold, name, unit into v_new_stock, v_threshold, v_name, v_unit;

  if not found then
    raise exception 'Insufficient stock for material % (requested delta %)', new.material_id, new.qty_delta
      using errcode = '23514';
  end if;

  v_old_stock := v_new_stock - new.qty_delta;

  if v_old_stock >= v_threshold and v_new_stock < v_threshold then
    insert into public.notifications (for_role, title, body, kind, link_url)
    values (
      'admin',
      'Low stock: ' || v_name,
      v_name || ' dropped to ' || v_new_stock || ' (threshold ' || v_threshold || ').',
      'warning',
      '/materials'
    );

    perform net.http_post(
      url := v_webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_webhook_secret),
      body := jsonb_build_object(
        'event', 'low_stock',
        'material', v_name,
        'stock', v_new_stock,
        'threshold', v_threshold,
        'unit', v_unit
      )
    );
  elsif v_old_stock < v_threshold and v_new_stock >= v_threshold then
    insert into public.notifications (for_role, title, body, kind, link_url)
    values (
      'admin',
      'Restocked: ' || v_name,
      v_name || ' is back up to ' || v_new_stock || ' (threshold ' || v_threshold || ').',
      'success',
      '/materials'
    );

    perform net.http_post(
      url := v_webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_webhook_secret),
      body := jsonb_build_object(
        'event', 'restocked',
        'material', v_name,
        'stock', v_new_stock,
        'threshold', v_threshold,
        'unit', v_unit
      )
    );
  end if;

  return new;
end;
$$;


-- ================================================================
-- FILE: 20260806120000_chat_attachments.sql
-- ================================================================
-- ============================================================
-- Chat attachments: allow an optional file/image on chat_messages,
-- backed by a new private "chat-attachments" storage bucket.
-- Mirrors the existing task-photos bucket pattern (auth-only access,
-- unguessable UUID paths, signed URLs for display).
-- ============================================================

alter table public.chat_messages
  add column attachment_url text,
  add column attachment_type text,
  add column attachment_name text;

alter table public.chat_messages
  add constraint chat_messages_has_content
  check (length(trim(message)) > 0 or attachment_url is not null);

insert into storage.buckets (id, name, public) values
  ('chat-attachments','chat-attachments', false)
on conflict (id) do nothing;

create policy "Auth read chat attachments"
on storage.objects for select to authenticated
using (bucket_id = 'chat-attachments');

create policy "Auth upload chat attachments"
on storage.objects for insert to authenticated
with check (bucket_id = 'chat-attachments');


-- ================================================================
-- FILE: 20260807090000_task_categories.sql
-- ================================================================
-- ============================================================
-- Task trade categories: lets a task be tagged by trade
-- (plumbing, electrical, roofing, etc.) so it can be visually
-- categorised on the task card, same idea as project template
-- categories. Free text (validated in the app), not an enum,
-- so an "other" category never blocks task creation.
-- ============================================================

alter table public.tasks
  add column category text not null default 'general';


-- ================================================================
-- FILE: 20260807150000_chat_enhancements.sql
-- ================================================================
-- ============================================================
-- Chat enhancements: read receipts, reactions, replies, edit/delete.
-- ============================================================

-- ---- Reply / edit / delete on chat_messages ----
-- Soft delete (deleted_at) keeps the row so replies still resolve and the
-- content-check constraint is never violated; the client renders a
-- "message deleted" placeholder instead of the original content.
alter table public.chat_messages
  add column reply_to_id uuid references public.chat_messages(id) on delete set null,
  add column edited_at timestamptz,
  add column deleted_at timestamptz;

create policy "Sender can update own messages" on public.chat_messages
  for update to authenticated
  using (sender_id = public.current_profile_id())
  with check (sender_id = public.current_profile_id());

-- ---- Read receipts ----
-- One row per user per project (a read *pointer*, not one row per message)
-- so "seen" status stays cheap to store and query as chats grow.
create table public.chat_reads (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table public.chat_reads enable row level security;

create policy "Project members read receipts" on public.chat_reads
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'project_manager')
    or public.has_role(auth.uid(),'site_supervisor')
    or public.is_project_member(project_id)
  );

create policy "Users upsert own read receipt" on public.chat_reads
  for insert to authenticated with check (user_id = public.current_profile_id());

create policy "Users update own read receipt" on public.chat_reads
  for update to authenticated
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

alter publication supabase_realtime add table public.chat_reads;

-- ---- Reactions ----
-- One reaction per user per message; picking a new emoji replaces the old one.
create table public.chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);
create index idx_chat_reactions_message on public.chat_reactions(message_id);

alter table public.chat_reactions enable row level security;

create policy "Read reactions if message visible" on public.chat_reactions
  for select to authenticated using (
    exists (
      select 1 from public.chat_messages m
      where m.id = message_id
        and (
          public.has_role(auth.uid(),'admin')
          or public.has_role(auth.uid(),'project_manager')
          or public.has_role(auth.uid(),'site_supervisor')
          or public.is_project_member(m.project_id)
        )
    )
  );

create policy "React to visible messages" on public.chat_reactions
  for insert to authenticated with check (
    user_id = public.current_profile_id()
    and exists (
      select 1 from public.chat_messages m
      where m.id = message_id
        and (
          public.has_role(auth.uid(),'admin')
          or public.has_role(auth.uid(),'project_manager')
          or public.has_role(auth.uid(),'site_supervisor')
          or public.is_project_member(m.project_id)
        )
    )
  );

create policy "Update own reaction" on public.chat_reactions
  for update to authenticated
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

create policy "Remove own reaction" on public.chat_reactions
  for delete to authenticated using (user_id = public.current_profile_id());

alter publication supabase_realtime add table public.chat_reactions;


-- ================================================================
-- FILE: 20260808090000_task_suggestions_delete.sql
-- ================================================================
-- task_suggestions had select/insert/update policies but no delete policy,
-- so admins/PMs could never actually delete a suggestion (RLS defaults to
-- deny). Needed for the "approve / reject / delete" review flow.
create policy "Admins/PM delete suggestions" on public.task_suggestions
  for delete to authenticated using (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'project_manager')
  );


-- ================================================================
-- FILE: 20260808100000_notification_dismissals.sql
-- ================================================================
-- Notifications can be personal (for_user_id) or role broadcasts (for_role),
-- and admins/PMs can see everyone's per the existing read policy — so a hard
-- DELETE on the row would remove it for other recipients too. Instead, track
-- per-user dismissals (same "read pointer" pattern as chat_reads) so anyone
-- can clear a notification from their own list without touching anyone else's.

create table if not exists public.notification_dismissals (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (profile_id, notification_id)
);

alter table public.notification_dismissals enable row level security;

drop policy if exists "Users manage their own dismissals" on public.notification_dismissals;
create policy "Users manage their own dismissals"
on public.notification_dismissals for all to authenticated
using (profile_id = current_profile_id())
with check (profile_id = current_profile_id());


-- ================================================================
-- FILE: 20260808110000_project_location.sql
-- ================================================================
-- Optional pin location for a project, so completed/active work can be
-- plotted on the project map. Nullable — most existing projects won't have
-- one until an admin sets it via the location picker.
alter table public.projects
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;


-- ================================================================
-- FILE: 20260808120000_admin_only_reviews.sql
-- ================================================================
-- Narrow review/approval authority to admins only (was admin+PM). Requesters
-- (PM/site supervisor/workers) keep the ability to raise material requests
-- and suggest tasks — only the approve/deny/delete step is being locked down.

drop policy if exists "Admins/PM update material requests" on public.material_requests;
create policy "Admins update material requests"
on public.material_requests for update to authenticated
using (public.has_role(auth.uid(),'admin'))
with check (public.has_role(auth.uid(),'admin'));

drop policy if exists "Admins/PM review suggestions" on public.task_suggestions;
create policy "Admins review suggestions"
on public.task_suggestions for update to authenticated
using (public.has_role(auth.uid(),'admin'));

drop policy if exists "Admins/PM delete suggestions" on public.task_suggestions;
create policy "Admins delete suggestions"
on public.task_suggestions for delete to authenticated
using (public.has_role(auth.uid(),'admin'));


-- ================================================================
-- FILE: 20260809090000_security_hardening.sql
-- ================================================================
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



-- ================================================================
-- FILE: 20261008120000_task_diary_entries.sql
-- ================================================================
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


-- ================================================================
-- FILE: 20261008130000_project_diary.sql
-- ================================================================
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


-- ================================================================
-- FILE: 20261008140000_diary_entry_title.sql
-- ================================================================
-- Diary entries get a short title so the project's Diary tab can list them
-- as "title + date" rows. Nullable: older entries without one fall back to
-- the start of their work_completed text in the app.
alter table public.task_diary_entries add column if not exists title text;

-- Make the change visible to the app's API immediately.
notify pgrst, 'reload schema';
