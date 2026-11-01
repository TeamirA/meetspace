-- Applied to the Supabase project outside Prisma (these objects live in Supabase-managed schemas).

-- Realtime private channels. The server signs a short-lived JWT carrying the room's two topics.
-- Members can read both topics; they can only write to the room topic, so the system topic is
-- effectively server-only (the service role bypasses RLS when it broadcasts host decisions).
create policy "room members can receive" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() in ((auth.jwt() ->> 'room_topic'), (auth.jwt() ->> 'system_topic'))
  );

create policy "room members can send" on realtime.messages
  for insert to authenticated
  with check (
    realtime.topic() = (auth.jwt() ->> 'room_topic')
    and realtime.messages.extension in ('broadcast', 'presence')
  );

-- Private bucket for client-side encrypted files (51 MB covers 50 MB + AES-GCM tag).
-- No storage policies: access only through short-lived signed URLs minted by the server.
insert into storage.buckets (id, name, public, file_size_limit)
values ('meeting-files', 'meeting-files', false, 53477376)
on conflict (id) do nothing;
