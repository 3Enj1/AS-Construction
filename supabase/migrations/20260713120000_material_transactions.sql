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
