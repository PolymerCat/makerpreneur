-- Materials Storage bucket + RLS policies
-- Run in Supabase SQL Editor after 0001_init.sql + 0002_rls_policies.sql

insert into storage.buckets (id, name, public)
  values ('materials', 'materials', true);

create policy "Materials are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'materials');

create policy "Authenticated users can upload materials"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'materials');

create policy "Authenticated users can delete own materials"
  on storage.objects for delete to authenticated
  using (bucket_id = 'materials');
