-- 0019_fix_signup_trigger.sql
-- Fixes: new signups fail with 500 "Database error saving new user".
--
-- Root cause: the signup trigger `on_auth_user_created` -> `public.handle_new_user()`
-- (from 0014_marketplace.sql) inserts the marketplace `profiles` columns
-- (name, email, avatar_url, is_verified, role). But the deployed `profiles`
-- table uses the study-hub schema (full_name, matric_number,
-- preferred_language, ...), so every insert fails and the whole auth.users
-- insert is rolled back -> signup returns 500.
--
-- Fix: replace the function with a defensive version that (1) never lets a
-- profile-creation failure block signup, and (2) writes whichever profile
-- columns actually exist (marketplace OR study-hub schema, or just id).
-- Apply manually in the Supabase SQL editor (there is no migration runner).///

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_name text := coalesce(new.raw_user_meta_data->>'name', '');
  v_avatar text := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    'https://picsum.photos/seed/' || new.id::text || '/100/100'
  );
  v_verified boolean := false;
  v_role text := 'user';
  v_has_name boolean;
  v_has_full_name boolean;
  v_has_email boolean;
  v_has_pref_lang boolean;
begin
  if v_email = 'admin@usm.my' then
    v_verified := true;
    v_role := 'admin';
  elsif v_email like '%@student.usm.my' then
    v_verified := true;
  end if;

  -- Sniff the real columns so this works with either profiles schema.
  select count(*) > 0 into v_has_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'name';
  select count(*) > 0 into v_has_full_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name';
  select count(*) > 0 into v_has_email
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email';
  select count(*) > 0 into v_has_pref_lang
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'preferred_language';

  perform set_config('puddle.bypass_identity_guard', 'on', true);

  begin
    if v_has_name and v_has_full_name and v_has_email then
      -- Bridged schema (study-hub + marketplace columns)
      if v_has_pref_lang then
        insert into public.profiles (id, name, full_name, email, avatar_url, is_verified, role, preferred_language)
        values (
          new.id,
          v_name,
          v_name,
          v_email,
          v_avatar,
          v_verified,
          case when v_role = 'admin' then 'admin' else 'student' end,
          'en'
        )
        on conflict (id) do update set
          email = excluded.email,
          name = case when excluded.name <> '' then excluded.name else profiles.name end,
          full_name = case
            when excluded.full_name <> '' then excluded.full_name
            else profiles.full_name
          end,
          is_verified = excluded.is_verified,
          role = case
            when excluded.role = 'admin' then 'admin'
            else profiles.role
          end;
      else
        insert into public.profiles (id, name, full_name, email, avatar_url, is_verified, role)
        values (
          new.id,
          v_name,
          v_name,
          v_email,
          v_avatar,
          v_verified,
          case when v_role = 'admin' then 'admin' else 'user' end
        )
        on conflict (id) do update set
          email = excluded.email,
          name = case when excluded.name <> '' then excluded.name else profiles.name end,
          full_name = case
            when excluded.full_name <> '' then excluded.full_name
            else profiles.full_name
          end,
          is_verified = excluded.is_verified,
          role = case
            when excluded.role = 'admin' then 'admin'
            else profiles.role
          end;
      end if;
    elsif v_has_name and v_has_email then
      -- Marketplace schema (0014_marketplace.sql)
      insert into public.profiles (id, name, email, avatar_url, is_verified, role)
      values (new.id, v_name, v_email, v_avatar, v_verified, v_role)
      on conflict (id) do update set
        email = excluded.email,
        name = case when excluded.name <> '' then excluded.name else profiles.name end,
        is_verified = excluded.is_verified,
        role = excluded.role;
    elsif v_has_full_name then
      -- Study-hub schema (full_name / matric_number / preferred_language / ...)
      insert into public.profiles (id, full_name, preferred_language)
      values (new.id, v_name, 'en')
      on conflict (id) do update set
        full_name = case when excluded.full_name <> '' then excluded.full_name else profiles.full_name end;
    else
      -- Unknown schema: at minimum keep the id so the user row exists.
      insert into public.profiles (id) values (new.id)
      on conflict (id) do nothing;
    end if;
  exception when others then
    -- A profile failure must never block account creation.
    null;
  end;

  perform set_config('puddle.bypass_identity_guard', 'off', true);
  return new;
end;
$$;

-- Re-create the trigger so it picks up the new function (harmless if unchanged).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
