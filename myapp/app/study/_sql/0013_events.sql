-- 0013_events.sql
-- MyCSD events board: shared across all authenticated users. Anyone can post
-- an event, anyone can register, the event creator manages the roster and
-- marks attendance. Follows the 0012_repository.sql RLS family (readable by
-- all authenticated, owner-writes) plus self-service registration rows.
-- Apply manually in the Supabase SQL editor (there is no migration runner).

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  organizer text not null,
  category text not null,
  starts_at timestamptz not null,
  location text not null,
  points integer not null default 0,
  fee text,
  registration_deadline timestamptz not null,
  description text,
  form_fields jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  registered_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'registered',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists event_registrations_event_idx on public.event_registrations (event_id);
create index if not exists event_registrations_user_idx on public.event_registrations (user_id);

alter table public.events enable row level security;
alter table public.event_registrations enable row level security;

-- events: everyone can read, only the creator writes. Cancellation is a soft
-- status update, so no delete is needed in v1 (owner delete kept for parity
-- with the repository family).
create policy "events readable by all authenticated"
  on public.events for select to authenticated using (true);
create policy "events insertable by authenticated"
  on public.events for insert to authenticated with check (created_by = auth.uid());
create policy "events owner can update"
  on public.events for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "events owner can delete"
  on public.events for delete to authenticated using (created_by = auth.uid());

-- registrations: self-service rows (you can read/insert/update your own); the
-- event creator can read and update every row on their own events (roster +
-- attendance marking). Rows are retained after cancellation, never deleted.
create policy "registrations readable by self or event owner"
  on public.event_registrations for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid())
  );
create policy "registrations insertable by self"
  on public.event_registrations for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.events e where e.id = event_id and e.status = 'open')
  );
create policy "registrations updatable by self or event owner"
  on public.event_registrations for update to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid())
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid())
  );
