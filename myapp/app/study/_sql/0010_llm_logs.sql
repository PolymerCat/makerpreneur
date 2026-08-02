-- ============================================================================
-- Migration: 0010_llm_logs.sql
-- Description: Creates public.llm_logs table for structured LLM execution logging,
--              enables Row Level Security (RLS) policies, and adds performance indexes.
-- ============================================================================

-- 1. Create public.llm_logs table
drop table if exists public.llm_logs cascade;

create table public.llm_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  request_id text,
  task text,
  model text,
  prompt_version text,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  cost_us numeric(12,8),
  tool_calls jsonb,
  retrieved_chunk_ids text[],
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security (RLS)
alter table public.llm_logs enable row level security;

drop policy if exists "Users can insert own llm logs" on public.llm_logs;
drop policy if exists "Users can select own llm logs" on public.llm_logs;

create policy "Users can insert own llm logs"
  on public.llm_logs for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can select own llm logs"
  on public.llm_logs for select to authenticated
  using (user_id = auth.uid());

-- 3. Create Indexes
create index if not exists llm_logs_request_id_idx on public.llm_logs (request_id);
create index if not exists llm_logs_created_at_desc_idx on public.llm_logs (created_at desc);
