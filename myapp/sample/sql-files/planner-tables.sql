-- Enable UUID generation if it is not already enabled
create extension if not exists "pgcrypto";

-- =========================================
-- CALENDAR EVENTS TABLE (study planner)
-- Covers both one-off events (study sessions,
-- tasks, personal) and weekly CLASSES. A weekly
-- class is stored as a single row with an rrule
-- (e.g. RRULE:FREQ=WEEKLY;BYDAY=MO,WE) and is
-- expanded into per-day instances in the UI.
-- =========================================

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  description text,
  location text,

  -- class | study | task | personal
  event_type text not null default 'study'
    check (event_type in ('class', 'study', 'task', 'personal')),

  start_time timestamptz not null,
  end_time timestamptz not null,

  -- Weekly recurrence for classes (RFC 5545 FREQ=WEEKLY)
  rrule text,

  -- FK to subjects; column intentionally stays named "course_id"
  course_id uuid references public.subjects(id) on delete set null,

  is_done boolean not null default false,

  -- Reserved for future calendar sync; unused for now
  google_event_id text,

  created_by uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================
-- CALENDAR EVENTS RLS POLICIES
-- Events are private to their owner.
-- =========================================

alter table public.calendar_events enable row level security;

create policy "users can read own calendar events"
  on public.calendar_events for select
  using (auth.uid() = created_by);

create policy "users can insert calendar events"
  on public.calendar_events for insert
  with check (auth.uid() = created_by);

create policy "users can update own calendar events"
  on public.calendar_events for update
  using (auth.uid() = created_by);

create policy "users can delete own calendar events"
  on public.calendar_events for delete
  using (auth.uid() = created_by);

-- =========================================
-- INDEXES
-- =========================================

create index if not exists calendar_events_created_by_idx
  on public.calendar_events (created_by);

create index if not exists calendar_events_start_time_idx
  on public.calendar_events (start_time);

-- =========================================
-- UPDATED_AT TRIGGER
-- =========================================

create extension if not exists "moddatetime";

create trigger handle_calendar_events_updated_at
  before update on public.calendar_events
  for each row
  execute procedure moddatetime(updated_at);
