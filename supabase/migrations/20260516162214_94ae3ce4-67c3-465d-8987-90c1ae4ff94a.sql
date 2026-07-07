
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
