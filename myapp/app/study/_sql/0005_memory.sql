-- 0005_memory.sql: 5-Layer LLM Memory System for Study Buddy
-- Run this in Supabase SQL Editor

-- 1. Unified memories table
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  type text not null check (type in ('fact','preference','goal','weakness','episode')),
  tags text[] not null default '{}',
  content text not null,
  importance real not null default 0.5,
  source text not null default 'chat',
  embedding vector(768),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists memories_user_idx on public.memories(user_id);
create index if not exists memories_course_idx on public.memories(course_id);
create index if not exists memories_embedding_idx on public.memories using hnsw (embedding vector_cosine_ops);

-- Unique index: exactly one episode row per conversation when type = 'episode'
create unique index if not exists memories_episode_conv_idx on public.memories(conversation_id) where type = 'episode';

-- 2. Add summary column to conversations table for rolling context memory
alter table public.conversations add column if not exists summary text not null default '';

-- 3. Add kind column to semcache table for answer cache discriminator
alter table public.semcache add column if not exists kind text not null default 'chunks';

-- 4. RPC: Vector search memories with double precision similarity return
create or replace function search_memories(
  query_embedding vector(768),
  match_user_id uuid,
  match_course_id uuid default null,
  match_count int default 8,
  match_threshold float default 0.3
) returns table (
  id uuid,
  type text,
  tags text[],
  content text,
  importance real,
  source text,
  similarity double precision
) language plpgsql as $$
begin
  return query
  select m.id, m.type, m.tags, m.content, m.importance, m.source,
         1 - (m.embedding <=> query_embedding) as similarity
  from memories m
  where m.user_id = match_user_id
    and m.embedding is not null
    and (match_course_id is null or m.course_id = match_course_id or m.course_id is null)
    and 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 5. RPC: Kind-aware semcache search with double precision similarity return
create or replace function search_semcache(
  query_embedding vector(768),
  match_threshold float default 0.95,
  match_kind text default 'chunks'
) returns table (
  id uuid,
  question text,
  answer text,
  similarity double precision
) language plpgsql as $$
begin
  return query
  select semcache.id, semcache.question, semcache.answer,
         1 - (semcache.embedding <=> query_embedding) as similarity
  from semcache
  where 1 - (semcache.embedding <=> query_embedding) > match_threshold
    and semcache.kind = match_kind
  order by semcache.embedding <=> query_embedding
  limit 1;
end;
$$;

-- 6. Row Level Security for memories table
alter table public.memories enable row level security;
drop policy if exists "authenticated all" on public.memories;
drop policy if exists "public all" on public.memories;
create policy "public all" on public.memories for all to public using (true) with check (true);

-- 7. Ensure semcache RLS permits public (anon + authenticated) operations
alter table public.semcache enable row level security;
drop policy if exists "authenticated all" on public.semcache;
drop policy if exists "public all" on public.semcache;
create policy "public all" on public.semcache for all to public using (true) with check (true);
