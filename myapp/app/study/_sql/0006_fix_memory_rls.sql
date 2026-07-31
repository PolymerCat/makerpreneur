-- 0006_fix_memory_rls.sql
-- Fix RLS policy violations for memories and semcache tables when accessed via server actions

-- 1. Memories table RLS fix (allow anon + authenticated so server actions can insert/update/delete)
alter table public.memories enable row level security;
drop policy if exists "authenticated all" on public.memories;
drop policy if exists "public all" on public.memories;
create policy "public all" on public.memories for all to public using (true) with check (true);

-- 2. Semcache table RLS fix (allow anon + authenticated so answer caching works from server)
alter table public.semcache enable row level security;
drop policy if exists "authenticated all" on public.semcache;
drop policy if exists "public all" on public.semcache;
create policy "public all" on public.semcache for all to public using (true) with check (true);
