-- Same schema as supabase/migrations/0001_init.sql
-- Copy for reference in study folder
-- Run in Supabase SQL Editor

create extension if not exists vector with schema extensions;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  file_url text not null default '',
  file_type text not null default '',
  status text not null default 'pending',
  created_at timestamptz default now(),
  category text not null default 'regular',
  year int not null default 2026,
  semester text not null default '1'
);

create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.materials(id) on delete cascade,
  page int not null default 1,
  chunk_index int not null default 0,
  text text not null,
  embedding vector(768)
);

create index if not exists chunks_material_idx on public.chunks(material_id);
create index if not exists chunks_embedding_idx on public.chunks using hnsw (embedding vector_cosine_ops);

create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  year int not null,
  semester text not null default '1',
  file_url text not null default '',
  extracted_text text not null default ''
);

create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.materials(id) on delete cascade,
  mode text not null,
  language text not null default 'en',
  content text not null
);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.materials(id) on delete cascade,
  title text not null
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid references public.decks(id) on delete cascade,
  front text not null,
  back text not null,
  easiness real not null default 2.5,
  interval int not null default 0,
  repetitions int not null default 0,
  due_date timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.materials(id) on delete cascade,
  title text not null
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  kind text not null default 'mcq',
  prompt text not null,
  options jsonb default '[]',
  answer text not null,
  rubric text default ''
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  score real not null default 0,
  answers jsonb default '[]',
  graded_at timestamptz default now()
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  exam_date text not null,
  goals text not null default ''
);

create table if not exists public.plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.study_plans(id) on delete cascade,
  day_number int not null default 1,
  date text not null,
  topic text not null default '',
  tasks jsonb default '[]',
  done boolean not null default false
);

create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'study',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default now()
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  created_at timestamptz default now(),
  freq_json jsonb default '{}',
  questions_json jsonb default '[]',
  studied_ids jsonb default '[]'
);

create table if not exists public.search_index (
  material_id uuid primary key references public.materials(id) on delete cascade,
  index_data jsonb default '{}'
);

create table if not exists public.semcache (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  embedding vector(768)
);

create or replace function search_chunks(
  query_embedding vector(768),
  match_material_id uuid,
  match_count int default 8
) returns table (
  id uuid,
  material_id uuid,
  page int,
  chunk_index int,
  text text,
  similarity real
) language plpgsql as $$
begin
  return query
  select
    chunks.id,
    chunks.material_id,
    chunks.page,
    chunks.chunk_index,
    chunks.text,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  where chunks.material_id = match_material_id
    and chunks.embedding is not null
  order by chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

create or replace function search_semcache(
  query_embedding vector(768),
  match_threshold float default 0.95
) returns table (
  id uuid,
  question text,
  answer text,
  similarity real
) language plpgsql as $$
begin
  return query
  select
    semcache.id,
    semcache.question,
    semcache.answer,
    1 - (semcache.embedding <=> query_embedding) as similarity
  from semcache
  where 1 - (semcache.embedding <=> query_embedding) > match_threshold
  order by semcache.embedding <=> query_embedding
  limit 1;
end;
$$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'New Chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  created_at timestamptz default now()
);

create index idx_messages_conv on public.messages(conversation_id, created_at);
create index idx_conversations_user on public.conversations(user_id, updated_at desc);
