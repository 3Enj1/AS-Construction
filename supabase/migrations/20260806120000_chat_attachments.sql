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
