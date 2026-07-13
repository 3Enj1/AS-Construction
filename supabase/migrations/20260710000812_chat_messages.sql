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
