-- ============================================================================
-- Migration: 0009_subjects_ownership.sql
-- Description: Renames public.courses to public.subjects, adds user ownership
--              (created_by), optional subject_code, description, and enforces
--              owner-scoped RLS policies across all study tables and storage.
-- ============================================================================

-- 1. Drop any legacy empty prototype table if it exists
drop table if exists public.subjects cascade;

-- 2. Rename existing courses table to subjects (FKs follow automatically)
alter table public.courses rename to subjects;

-- 3. Add columns: subject_code, description, and created_by
alter table public.subjects
  add column if not exists subject_code text null,
  add column if not exists description text null,
  add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete cascade;

-- 4. Clean up any old unowned global course rows (fresh start)
delete from public.subjects where created_by is null;

-- 4. Partial unique index: one user cannot duplicate a non-null code
create unique index if not exists subjects_user_code_idx
  on public.subjects (created_by, subject_code)
  where subject_code is not null;

-- ============================================================================
-- 5. Row Level Security (RLS) on public.subjects
-- ============================================================================
alter table public.subjects enable row level security;

drop policy if exists "authenticated users can insert courses" on public.subjects;
drop policy if exists "authenticated users can view courses" on public.subjects;
drop policy if exists "authenticated users can update courses" on public.subjects;
drop policy if exists "authenticated users can delete courses" on public.subjects;
drop policy if exists "Users can view own subjects" on public.subjects;
drop policy if exists "Users can create own subjects" on public.subjects;
drop policy if exists "Users can update own subjects" on public.subjects;
drop policy if exists "Users can delete own subjects" on public.subjects;

create policy "Users can view own subjects"
  on public.subjects for select to authenticated
  using (created_by = auth.uid());

create policy "Users can create own subjects"
  on public.subjects for insert to authenticated
  with check (created_by = auth.uid());

create policy "Users can update own subjects"
  on public.subjects for update to authenticated
  using (created_by = auth.uid());

create policy "Users can delete own subjects"
  on public.subjects for delete to authenticated
  using (created_by = auth.uid());

-- ============================================================================
-- 6. Owner-Scoped RLS on Direct Child Tables
--    (materials, papers, study_plans, predictions, generated_exams, memories)
-- ============================================================================

-- materials
alter table public.materials enable row level security;
drop policy if exists "authenticated all" on public.materials;
drop policy if exists "Users can manage own materials" on public.materials;
create policy "Users can manage own materials"
  on public.materials for all to authenticated
  using (exists (select 1 from public.subjects s where s.id = materials.course_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.subjects s where s.id = materials.course_id and s.created_by = auth.uid()));

-- papers
alter table public.papers enable row level security;
drop policy if exists "authenticated all" on public.papers;
drop policy if exists "Users can manage own papers" on public.papers;
create policy "Users can manage own papers"
  on public.papers for all to authenticated
  using (exists (select 1 from public.subjects s where s.id = papers.course_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.subjects s where s.id = papers.course_id and s.created_by = auth.uid()));

-- study_plans
alter table public.study_plans enable row level security;
drop policy if exists "authenticated all" on public.study_plans;
drop policy if exists "Users can manage own study_plans" on public.study_plans;
create policy "Users can manage own study_plans"
  on public.study_plans for all to authenticated
  using (exists (select 1 from public.subjects s where s.id = study_plans.course_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.subjects s where s.id = study_plans.course_id and s.created_by = auth.uid()));

-- predictions
alter table public.predictions enable row level security;
drop policy if exists "authenticated all" on public.predictions;
drop policy if exists "Users can manage own predictions" on public.predictions;
create policy "Users can manage own predictions"
  on public.predictions for all to authenticated
  using (exists (select 1 from public.subjects s where s.id = predictions.course_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.subjects s where s.id = predictions.course_id and s.created_by = auth.uid()));

-- generated_exams
alter table public.generated_exams enable row level security;
drop policy if exists "authenticated all" on public.generated_exams;
drop policy if exists "Users can manage own generated_exams" on public.generated_exams;
create policy "Users can manage own generated_exams"
  on public.generated_exams for all to authenticated
  using (exists (select 1 from public.subjects s where s.id = generated_exams.course_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.subjects s where s.id = generated_exams.course_id and s.created_by = auth.uid()));

-- memories
alter table public.memories enable row level security;
drop policy if exists "authenticated all" on public.memories;
drop policy if exists "Users can view their own memories" on public.memories;
drop policy if exists "Users can insert their own memories" on public.memories;
drop policy if exists "Users can update their own memories" on public.memories;
drop policy if exists "Users can delete their own memories" on public.memories;
drop policy if exists "Users can manage own memories" on public.memories;
create policy "Users can manage own memories"
  on public.memories for all to authenticated
  using (exists (select 1 from public.subjects s where s.id = memories.course_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.subjects s where s.id = memories.course_id and s.created_by = auth.uid()));

-- ============================================================================
-- 7. Owner-Scoped RLS on Nested Child Tables
--    (chunks, summaries, decks, cards, quizzes, questions, attempts, search_index)
-- ============================================================================

-- chunks (via materials)
alter table public.chunks enable row level security;
drop policy if exists "authenticated all" on public.chunks;
drop policy if exists "Users can manage own chunks" on public.chunks;
create policy "Users can manage own chunks"
  on public.chunks for all to authenticated
  using (exists (select 1 from public.materials m join public.subjects s on m.course_id = s.id where m.id = chunks.material_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.materials m join public.subjects s on m.course_id = s.id where m.id = chunks.material_id and s.created_by = auth.uid()));

-- summaries (via materials)
alter table public.summaries enable row level security;
drop policy if exists "authenticated all" on public.summaries;
drop policy if exists "Users can manage own summaries" on public.summaries;
create policy "Users can manage own summaries"
  on public.summaries for all to authenticated
  using (exists (select 1 from public.materials m join public.subjects s on m.course_id = s.id where m.id = summaries.material_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.materials m join public.subjects s on m.course_id = s.id where m.id = summaries.material_id and s.created_by = auth.uid()));

-- decks (via materials)
alter table public.decks enable row level security;
drop policy if exists "authenticated all" on public.decks;
drop policy if exists "Users can manage own decks" on public.decks;
create policy "Users can manage own decks"
  on public.decks for all to authenticated
  using (exists (select 1 from public.materials m join public.subjects s on m.course_id = s.id where m.id = decks.material_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.materials m join public.subjects s on m.course_id = s.id where m.id = decks.material_id and s.created_by = auth.uid()));

-- cards (via decks -> materials -> subjects)
alter table public.cards enable row level security;
drop policy if exists "authenticated all" on public.cards;
drop policy if exists "Users can manage own cards" on public.cards;
create policy "Users can manage own cards"
  on public.cards for all to authenticated
  using (exists (select 1 from public.decks d join public.materials m on d.material_id = m.id join public.subjects s on m.course_id = s.id where d.id = cards.deck_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.decks d join public.materials m on d.material_id = m.id join public.subjects s on m.course_id = s.id where d.id = cards.deck_id and s.created_by = auth.uid()));

-- quizzes (via materials)
alter table public.quizzes enable row level security;
drop policy if exists "authenticated all" on public.quizzes;
drop policy if exists "Users can manage own quizzes" on public.quizzes;
create policy "Users can manage own quizzes"
  on public.quizzes for all to authenticated
  using (exists (select 1 from public.materials m join public.subjects s on m.course_id = s.id where m.id = quizzes.material_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.materials m join public.subjects s on m.course_id = s.id where m.id = quizzes.material_id and s.created_by = auth.uid()));

-- questions (via quizzes -> materials -> subjects)
alter table public.questions enable row level security;
drop policy if exists "authenticated all" on public.questions;
drop policy if exists "Users can manage own questions" on public.questions;
create policy "Users can manage own questions"
  on public.questions for all to authenticated
  using (exists (select 1 from public.quizzes q join public.materials m on q.material_id = m.id join public.subjects s on m.course_id = s.id where q.id = questions.quiz_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.quizzes q join public.materials m on q.material_id = m.id join public.subjects s on m.course_id = s.id where q.id = questions.quiz_id and s.created_by = auth.uid()));

-- attempts (via quizzes -> materials -> subjects)
alter table public.attempts enable row level security;
drop policy if exists "authenticated all" on public.attempts;
drop policy if exists "Users can manage own attempts" on public.attempts;
create policy "Users can manage own attempts"
  on public.attempts for all to authenticated
  using (exists (select 1 from public.quizzes q join public.materials m on q.material_id = m.id join public.subjects s on m.course_id = s.id where q.id = attempts.quiz_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.quizzes q join public.materials m on q.material_id = m.id join public.subjects s on m.course_id = s.id where q.id = attempts.quiz_id and s.created_by = auth.uid()));

-- search_index (via materials)
alter table public.search_index enable row level security;
drop policy if exists "authenticated all" on public.search_index;
drop policy if exists "Users can manage own search_index" on public.search_index;
create policy "Users can manage own search_index"
  on public.search_index for all to authenticated
  using (exists (select 1 from public.materials m join public.subjects s on m.course_id = s.id where m.id = search_index.material_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.materials m join public.subjects s on m.course_id = s.id where m.id = search_index.material_id and s.created_by = auth.uid()));

-- ============================================================================
-- 8. Owner-Scoped RLS on User-Owned Tables (conversations, messages)
-- ============================================================================

-- conversations
alter table public.conversations enable row level security;
drop policy if exists "authenticated all" on public.conversations;
drop policy if exists "Users can manage own conversations" on public.conversations;
create policy "Users can manage own conversations"
  on public.conversations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- messages (via conversations)
alter table public.messages enable row level security;
drop policy if exists "authenticated all" on public.messages;
drop policy if exists "Users can manage own messages" on public.messages;
create policy "Users can manage own messages"
  on public.messages for all to authenticated
  using (exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.user_id = auth.uid()));

-- ============================================================================
-- 9. Owner-Scoped RLS on Storage (materials bucket)
-- ============================================================================

drop policy if exists "Allow public read on materials bucket" on storage.objects;
drop policy if exists "Allow public insert on materials bucket" on storage.objects;
drop policy if exists "Allow public update on materials bucket" on storage.objects;
drop policy if exists "Allow public delete on materials bucket" on storage.objects;
drop policy if exists "Users can access own material files" on storage.objects;

drop policy if exists "storage: owner can select" on storage.objects;
drop policy if exists "storage: owner can insert" on storage.objects;
drop policy if exists "storage: owner can update" on storage.objects;
drop policy if exists "storage: owner can delete" on storage.objects;

create policy "storage: owner can select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'materials' and
    exists (
      select 1 from public.subjects s
      where s.id::text = split_part(name, '/', 1)
      and s.created_by = auth.uid()
    )
  );

create policy "storage: owner can insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'materials' and
    exists (
      select 1 from public.subjects s
      where s.id::text = split_part(name, '/', 1)
      and s.created_by = auth.uid()
    )
  );

create policy "storage: owner can update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'materials' and
    exists (
      select 1 from public.subjects s
      where s.id::text = split_part(name, '/', 1)
      and s.created_by = auth.uid()
    )
  );

create policy "storage: owner can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'materials' and
    exists (
      select 1 from public.subjects s
      where s.id::text = split_part(name, '/', 1)
      and s.created_by = auth.uid()
    )
  );
