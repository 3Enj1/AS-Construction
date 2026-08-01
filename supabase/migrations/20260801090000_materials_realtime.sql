-- Live stock updates on the Materials page: broadcast INSERT/UPDATE/DELETE
-- on materials so every open session sees stock changes immediately,
-- matching the existing chat_messages realtime pattern.
alter publication supabase_realtime add table public.materials;
