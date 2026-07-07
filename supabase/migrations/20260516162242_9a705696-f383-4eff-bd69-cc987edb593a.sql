
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
