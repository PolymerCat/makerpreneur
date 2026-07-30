-- Enable UUID generation if it is not already enabled
create extension if not exists "pgcrypto";

-- =========================================
-- USER PROFILE TABLE
-- =========================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  full_name text not null,
  matric_number text unique,
  preferred_language text not null default 'en'
    check (preferred_language in ('en', 'bm')),

  role text not null default 'student'
    check (role in ('student', 'admin')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================
-- SUBJECT TABLE
-- =========================================

create table public.subjects (
  id uuid primary key default gen_random_uuid(),

  subject_code text not null unique,
  subject_name text not null,
  description text,

  created_by uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================
-- SUBJECT RLS POLICIES
-- =========================================

alter table public.subjects enable row level security;

-- Any authenticated user can browse all subjects
create policy "any authenticated can read subjects"
  on public.subjects for select
  using (auth.role() = 'authenticated');

-- Authenticated users can create subjects (created_by is forced to their own ID)
create policy "users can insert subjects"
  on public.subjects for insert
  with check (auth.uid() = created_by);

-- Only the creator can update their subjects
create policy "users can update own subjects"
  on public.subjects for update
  using (auth.uid() = created_by);

-- Only the creator can delete their subjects
create policy "users can delete own subjects"
  on public.subjects for delete
  using (auth.uid() = created_by);