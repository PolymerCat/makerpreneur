-- 0015_events_storage_bucket.sql
-- Create public storage bucket for event poster images and RLS policies

insert into storage.buckets (id, name, public)
values ('events', 'events', true)
on conflict (id) do update set public = true;

drop policy if exists "events-posters publicly accessible" on storage.objects;
drop policy if exists "events-posters authenticated upload" on storage.objects;
drop policy if exists "events-posters owner can delete" on storage.objects;

create policy "events-posters publicly accessible"
  on storage.objects for select to public
  using (bucket_id = 'events');

create policy "events-posters authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'events');

create policy "events-posters owner can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'events');
