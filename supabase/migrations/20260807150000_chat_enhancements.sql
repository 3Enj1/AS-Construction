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
