-- 0018_sos_alerts.sql
-- SOS distress alerts. The reporter (user_id) records their current location
-- and the alert is addressed to a designated security recipient
-- (recipient_user_id). Prototype loop: the security user logs in and reads
-- incoming alerts addressed to them on the /sos page, then acknowledges them.
-- Apply manually in the Supabase SQL editor (there is no migration runner).

create table if not exists public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete set null,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  note text,
  status text not null default 'sent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sos_alerts_user_idx on public.sos_alerts (user_id);
create index if not exists sos_alerts_recipient_idx on public.sos_alerts (recipient_user_id);
create index if not exists sos_alerts_created_at_idx on public.sos_alerts (created_at);

alter table public.sos_alerts enable row level security;

-- Reporter owns their own alerts: insert, read, and update (e.g. cancel).
create policy "sos reporter can insert own alerts"
  on public.sos_alerts for insert to authenticated
  with check (user_id = auth.uid());

create policy "sos reporter can read own alerts"
  on public.sos_alerts for select to authenticated
  using (user_id = auth.uid());

create policy "sos reporter can update own alerts"
  on public.sos_alerts for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The designated security recipient reads and acknowledges alerts addressed
-- to them. No blanket select-all policy.
create policy "sos recipient can read addressed alerts"
  on public.sos_alerts for select to authenticated
  using (recipient_user_id = auth.uid());

create policy "sos recipient can update addressed alerts"
  on public.sos_alerts for update to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());
