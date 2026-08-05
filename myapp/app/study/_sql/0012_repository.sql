-- ============================================================================
-- Migration: 0012_repository.sql
-- Description: Exam Paper Repository — shared, cross-user library of past
--              year papers. Faculty/school taxonomy + shared course list +
--              papers with uploader attribution.
-- ============================================================================

-- ============================================================================
-- 1. Storage bucket (public read; authenticated upload)
-- ============================================================================
--dummy
insert into storage.buckets (id, name, public)
  values ('repository-papers', 'repository-papers', true)
  on conflict (id) do nothing;

drop policy if exists "repository-papers publicly accessible" on storage.objects;
drop policy if exists "repository-papers authenticated upload" on storage.objects;
drop policy if exists "repository-papers owner can delete" on storage.objects;

create policy "repository-papers publicly accessible"
  on storage.objects for select
  using (bucket_id = 'repository-papers');

create policy "repository-papers authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'repository-papers');

create policy "repository-papers owner can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'repository-papers' and owner = auth.uid());

-- ============================================================================
-- 2. faculties
-- ============================================================================

create table if not exists public.faculties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.faculties enable row level security;

drop policy if exists "faculties readable by all authenticated" on public.faculties;
drop policy if exists "faculties insertable by authenticated" on public.faculties;
drop policy if exists "faculties owner can update" on public.faculties;
drop policy if exists "faculties owner can delete" on public.faculties;

create policy "faculties readable by all authenticated"
  on public.faculties for select to authenticated
  using (true);

create policy "faculties insertable by authenticated"
  on public.faculties for insert to authenticated
  with check (created_by = auth.uid());

create policy "faculties owner can update"
  on public.faculties for update to authenticated
  using (created_by = auth.uid());

create policy "faculties owner can delete"
  on public.faculties for delete to authenticated
  using (created_by = auth.uid());

-- ============================================================================
-- 3. repository_courses
-- ============================================================================

create table if not exists public.repository_courses (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties(id) on delete cascade,
  course_code text not null,
  course_name text not null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (faculty_id, course_code)
);

alter table public.repository_courses enable row level security;

drop policy if exists "repository courses readable by all authenticated" on public.repository_courses;
drop policy if exists "repository courses insertable by authenticated" on public.repository_courses;
drop policy if exists "repository courses owner can update" on public.repository_courses;
drop policy if exists "repository courses owner can delete" on public.repository_courses;

create policy "repository courses readable by all authenticated"
  on public.repository_courses for select to authenticated
  using (true);

create policy "repository courses insertable by authenticated"
  on public.repository_courses for insert to authenticated
  with check (created_by = auth.uid());

create policy "repository courses owner can update"
  on public.repository_courses for update to authenticated
  using (created_by = auth.uid());

create policy "repository courses owner can delete"
  on public.repository_courses for delete to authenticated
  using (created_by = auth.uid());

-- ============================================================================
-- 4. repository_papers
-- ============================================================================

create table if not exists public.repository_papers (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.repository_courses(id) on delete cascade,
  title text not null,
  year integer not null,
  semester text not null default '1',
  file_url text not null default '',
  file_type text not null default '',
  file_size integer,
  tags text[] not null default '{}',
  extracted_text text not null default '',
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  uploaded_by_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.repository_papers enable row level security;

drop policy if exists "repository papers readable by all authenticated" on public.repository_papers;
drop policy if exists "repository papers insertable by authenticated" on public.repository_papers;
drop policy if exists "repository papers owner can update" on public.repository_papers;
drop policy if exists "repository papers owner can delete" on public.repository_papers;

create policy "repository papers readable by all authenticated"
  on public.repository_papers for select to authenticated
  using (true);

create policy "repository papers insertable by authenticated"
  on public.repository_papers for insert to authenticated
  with check (uploaded_by = auth.uid());

create policy "repository papers owner can update"
  on public.repository_papers for update to authenticated
  using (uploaded_by = auth.uid());

create policy "repository papers owner can delete"
  on public.repository_papers for delete to authenticated
  using (uploaded_by = auth.uid());
