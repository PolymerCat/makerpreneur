-- Study Buddy: Full rollback
-- Run this in Supabase SQL Editor to undo 0001_init.sql
-- WARNING: Drops ALL study data permanently.

-- Drop functions (order doesn't matter)
drop function if exists search_semcache(vector, float);
drop function if exists search_chunks(vector, uuid, int);

-- Drop tables (reverse dependency order)
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;
drop table if exists public.plan_days cascade;
drop table if exists public.search_index cascade;
drop table if exists public.predictions cascade;
drop table if exists public.schedule_blocks cascade;
drop table if exists public.attempts cascade;
drop table if exists public.questions cascade;
drop table if exists public.quizzes cascade;
drop table if exists public.cards cascade;
drop table if exists public.decks cascade;
drop table if exists public.summaries cascade;
drop table if exists public.papers cascade;
drop table if exists public.chunks cascade;
drop table if exists public.materials cascade;
drop table if exists public.study_plans cascade;
drop table if exists public.semcache cascade;
drop table if exists public.courses cascade;

-- Extension: keep by default, uncomment to drop
-- drop extension if exists vector cascade;
