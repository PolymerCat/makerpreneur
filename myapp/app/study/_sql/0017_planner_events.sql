-- 0017_planner_events.sql
-- Main User-Scoped Planner Events (/planner)
-- Run this script in the Supabase SQL Editor.

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
