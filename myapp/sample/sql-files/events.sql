create table public.events (
  id uuid not null default gen_random_uuid (),
  created_by uuid not null,
  name text not null,
  organizer text not null,
  category text not null,
  starts_at timestamp with time zone not null,
  location text not null,
  points integer not null default 0,
  fee text null,
  registration_deadline timestamp with time zone not null,
  description text null,
  form_fields jsonb not null default '[]'::jsonb,
  status text not null default 'open'::text,
  registered_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  ends_at timestamp with time zone null,
  image_url text null,
  constraint events_pkey primary key (id),
  constraint events_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists events_starts_at_idx on public.events using btree (starts_at) TABLESPACE pg_default;