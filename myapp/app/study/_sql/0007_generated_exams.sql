-- 0007_generated_exams.sql
-- Create a table for tracking generated PDF exam papers

create table if not exists public.generated_exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  course_code text not null default 'CST434',
  file_url text not null default '',
  questions_json jsonb default '{}',
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.generated_exams enable row level security;

-- Set policy to public all (consistent with our current dev server actions pattern)
create policy "public all generated_exams"
  on public.generated_exams
  for all using (true) with check (true);
