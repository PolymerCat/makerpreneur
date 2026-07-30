-- Enable RLS policies for all study tables
-- Run in Supabase SQL Editor after 0001_init.sql

-- Courses
alter table public.courses enable row level security;
create policy "authenticated users can insert courses" on public.courses for insert to authenticated with check (true);
create policy "authenticated users can view courses" on public.courses for select to authenticated using (true);
create policy "authenticated users can update courses" on public.courses for update to authenticated using (true);
create policy "authenticated users can delete courses" on public.courses for delete to authenticated using (true);

-- Materials
alter table public.materials enable row level security;
create policy "authenticated all" on public.materials for all to authenticated using (true) with check (true);

-- Chunks
alter table public.chunks enable row level security;
create policy "authenticated all" on public.chunks for all to authenticated using (true) with check (true);

-- Papers
alter table public.papers enable row level security;
create policy "authenticated all" on public.papers for all to authenticated using (true) with check (true);

-- Summaries
alter table public.summaries enable row level security;
create policy "authenticated all" on public.summaries for all to authenticated using (true) with check (true);

-- Decks
alter table public.decks enable row level security;
create policy "authenticated all" on public.decks for all to authenticated using (true) with check (true);

-- Cards
alter table public.cards enable row level security;
create policy "authenticated all" on public.cards for all to authenticated using (true) with check (true);

-- Quizzes
alter table public.quizzes enable row level security;
create policy "authenticated all" on public.quizzes for all to authenticated using (true) with check (true);

-- Questions
alter table public.questions enable row level security;
create policy "authenticated all" on public.questions for all to authenticated using (true) with check (true);

-- Attempts
alter table public.attempts enable row level security;
create policy "authenticated all" on public.attempts for all to authenticated using (true) with check (true);

-- Study plans
alter table public.study_plans enable row level security;
create policy "authenticated all" on public.study_plans for all to authenticated using (true) with check (true);

-- Plan days
alter table public.plan_days enable row level security;
create policy "authenticated all" on public.plan_days for all to authenticated using (true) with check (true);

-- Schedule blocks
alter table public.schedule_blocks enable row level security;
create policy "authenticated all" on public.schedule_blocks for all to authenticated using (true) with check (true);

-- Predictions
alter table public.predictions enable row level security;
create policy "authenticated all" on public.predictions for all to authenticated using (true) with check (true);

-- Search index
alter table public.search_index enable row level security;
create policy "authenticated all" on public.search_index for all to authenticated using (true) with check (true);

-- Semcache
alter table public.semcache enable row level security;
create policy "authenticated all" on public.semcache for all to authenticated using (true) with check (true);

-- Conversations
alter table public.conversations enable row level security;
create policy "authenticated all" on public.conversations for all to authenticated using (true) with check (true);

-- Messages
alter table public.messages enable row level security;
create policy "authenticated all" on public.messages for all to authenticated using (true) with check (true);
