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
