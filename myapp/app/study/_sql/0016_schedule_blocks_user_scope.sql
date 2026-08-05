-- 0016_schedule_blocks_user_scope.sql
-- Makes schedule_blocks user-scoped by adding user_id and replacing the
-- blanket "authenticated all" RLS policy with a per-user ownership policy.
-- Apply manually in the Supabase SQL editor.

-- 1. Add user_id column (nullable so the ALTER does not fail on existing rows)
ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Drop the old permissive policy that let every user read/write all blocks
DROP POLICY IF EXISTS "authenticated all" ON public.schedule_blocks;

-- 3. Re-create user-scoped CRUD policy
--    USING  → only rows WHERE user_id = calling user are visible / editable
--    WITH CHECK → inserts/updates must carry the calling user's id
CREATE POLICY "schedule_blocks_owner_crud"
  ON public.schedule_blocks
  FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Note: existing rows that have user_id = NULL will no longer be visible
-- to any user (NULL != auth.uid()). This is intentional — old ownerless
-- rows are treated as orphaned data and are effectively hidden.
-- Run the following if you want to clean them up:
--   DELETE FROM public.schedule_blocks WHERE user_id IS NULL;
