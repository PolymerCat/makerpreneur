-- Storage RLS Policies for Materials bucket (including generated_exams PDFs)
-- Run this script in your Supabase SQL Editor to allow public/anon upload and update access to the 'materials' bucket.

-- Drop existing policies if they conflict
drop policy if exists "Allow public read on materials bucket" on storage.objects;
drop policy if exists "Allow public insert on materials bucket" on storage.objects;
drop policy if exists "Allow public update on materials bucket" on storage.objects;
drop policy if exists "Allow public delete on materials bucket" on storage.objects;
drop policy if exists "Materials are publicly accessible" on storage.objects;
drop policy if exists "Authenticated users can upload materials" on storage.objects;
drop policy if exists "Authenticated users can delete own materials" on storage.objects;

-- Create policies allowing full public access to materials bucket
create policy "Allow public read on materials bucket"
  on storage.objects for select to public
  using ( bucket_id = 'materials' );

create policy "Allow public insert on materials bucket"
  on storage.objects for insert to public
  with check ( bucket_id = 'materials' );

create policy "Allow public update on materials bucket"
  on storage.objects for update to public
  using ( bucket_id = 'materials' );

create policy "Allow public delete on materials bucket"
  on storage.objects for delete to public
  using ( bucket_id = 'materials' );
