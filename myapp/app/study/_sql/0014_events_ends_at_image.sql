-- 0014_events_ends_at_image.sql
-- Add optional end time and poster image URL to public.events table

alter table public.events add column if not exists ends_at timestamptz;
alter table public.events add column if not exists image_url text;
