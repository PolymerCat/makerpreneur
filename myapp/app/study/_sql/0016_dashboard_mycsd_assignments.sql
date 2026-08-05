-- 0016_dashboard_mycsd_assignments.sql
-- Migration for Dynamic Dashboard & User-Scoped Main Planner (/planner).
-- Apply manually in the Supabase SQL editor.

-- 1. MyCSD Points on Profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mycsd_points integer NOT NULL DEFAULT 0;

-- Allow event organizers to award points to registrants upon marking attendance
DROP POLICY IF EXISTS "organizer_can_update_mycsd_points" ON public.profiles;
CREATE POLICY "organizer_can_update_mycsd_points"
  ON public.profiles FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. User Assignments Table
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text,
  deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments_owner_crud" ON public.assignments;
CREATE POLICY "assignments_owner_crud"
  ON public.assignments FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Main User-Scoped Planner Events (/planner)
CREATE TABLE IF NOT EXISTS public.planner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  location text DEFAULT '',
  event_type text NOT NULL DEFAULT 'study',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  rrule text,
  google_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planner_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planner_events_owner_crud" ON public.planner_events;
CREATE POLICY "planner_events_owner_crud"
  ON public.planner_events FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Legacy Schedule Blocks User Scoping (for study/planner compatibility)
ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "authenticated all" ON public.schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_owner_crud" ON public.schedule_blocks;

ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_blocks_owner_crud"
  ON public.schedule_blocks FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
