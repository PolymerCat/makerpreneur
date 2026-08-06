-- 0015_marketplace_storage_bucket.sql
-- Creates the public `image_uploads` Storage bucket for marketplace photos.
-- Only needed if 0014_marketplace.sql was applied before the bucket insert
-- was added to it. Idempotent: safe to run once on an existing project.
-- Apply manually in the Supabase SQL editor (there is no migration runner).

insert into storage.buckets (id, name, public)
values ('image_uploads', 'image_uploads', true)
on conflict (id) do nothing;
