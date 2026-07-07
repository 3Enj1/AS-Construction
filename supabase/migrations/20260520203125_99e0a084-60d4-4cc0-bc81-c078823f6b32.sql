
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
