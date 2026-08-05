-- 0011_memory_global_rls.sql
-- Replace the permissive "public all" policy (0006) and the unguarded 0009
-- policy with a single owner-scoped policy that also allows GLOBAL memories
-- (course_id IS NULL, e.g. name / language preferences saved via save_memory).
--
-- NOTE: 0009's policy blocked global memories because `s.id = NULL` is never
-- true. It also lacked a user_id = auth.uid() guard. This policy supersedes it.
-- Apply manually in the Supabase SQL editor (there is no migration runner).

alter table public.memories enable row level security;

drop policy if exists "public all" on public.memories;
drop policy if exists "authenticated all" on public.memories;
drop policy if exists "Users can view their own memories" on public.memories;
drop policy if exists "Users can insert their own memories" on public.memories;
drop policy if exists "Users can update their own memories" on public.memories;
drop policy if exists "Users can delete their own memories" on public.memories;
drop policy if exists "Users can manage own memories" on public.memories;

create policy "Users can manage own memories"
  on public.memories for all to authenticated
  using (
    memories.user_id = auth.uid()
    and (
      memories.course_id is null
      or exists (
        select 1 from public.subjects s
        where s.id = memories.course_id and s.created_by = auth.uid()
      )
    )
  )
  with check (
    memories.user_id = auth.uid()
    and (
      memories.course_id is null
      or exists (
        select 1 from public.subjects s
        where s.id = memories.course_id and s.created_by = auth.uid()
      )
    )
  );
