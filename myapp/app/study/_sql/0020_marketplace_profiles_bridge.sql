-- 0020_marketplace_profiles_bridge.sql
-- Bridges study-hub profiles (full_name, role=student|admin) with marketplace
-- columns (name, email, avatar_url, is_verified, qr_code_url, payment_note,
-- role=user|admin) so seller names and /marketplace/profile work.
-- Apply manually in the Supabase SQL editor after 0014 + 0019.

-- 1) Add marketplace profile columns when the study-hub table already exists
alter table public.profiles
  add column if not exists name text not null default '';

alter table public.profiles
  add column if not exists email text not null default '';

alter table public.profiles
  add column if not exists avatar_url text not null default '';

alter table public.profiles
  add column if not exists is_verified boolean not null default false;

alter table public.profiles
  add column if not exists qr_code_url text;

alter table public.profiles
  add column if not exists payment_note text;

do $$
begin
  alter table public.profiles
    add constraint profiles_payment_note_len
    check (payment_note is null or char_length(payment_note) <= 120);
exception
  when duplicate_object then null;
end $$;

-- 2) Allow both study-hub and marketplace role values
alter table public.profiles drop constraint if exists profiles_role_check;

do $$
begin
  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('student', 'user', 'admin'));
exception
  when duplicate_object then null;
end $$;

-- 3) Backfill display name + email from whichever side already has data
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'
  ) then
    update public.profiles
    set name = full_name
    where coalesce(nullif(trim(name), ''), '') = ''
      and coalesce(nullif(trim(full_name), ''), '') <> '';

    update public.profiles
    set full_name = name
    where coalesce(nullif(trim(full_name), ''), '') = ''
      and coalesce(nullif(trim(name), ''), '') <> '';
  end if;
end $$;

update public.profiles p
set email = coalesce(nullif(p.email, ''), u.email, '')
from auth.users u
where u.id = p.id
  and coalesce(nullif(trim(p.email), ''), '') = '';

update public.profiles
set is_verified = true
where lower(email) like '%@student.usm.my'
   or lower(email) = 'admin@usm.my';

update public.profiles
set role = 'admin'
where lower(email) = 'admin@usm.my'
  and role is distinct from 'admin';

-- 4) Keep name <-> full_name in sync on write (when both columns exist)
create or replace function public.sync_marketplace_profile_names()
returns trigger
language plpgsql
as $$
declare
  v_has_full_name boolean;
begin
  select count(*) > 0 into v_has_full_name
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name';

  if not v_has_full_name then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(nullif(trim(new.name), ''), '') = ''
       and coalesce(nullif(trim(new.full_name), ''), '') <> '' then
      new.name := new.full_name;
    elsif coalesce(nullif(trim(new.full_name), ''), '') = ''
          and coalesce(nullif(trim(new.name), ''), '') <> '' then
      new.full_name := new.name;
    end if;
    return new;
  end if;

  if new.name is distinct from old.name
     and coalesce(nullif(trim(new.name), ''), '') <> '' then
    new.full_name := new.name;
  elsif new.full_name is distinct from old.full_name
        and coalesce(nullif(trim(new.full_name), ''), '') <> '' then
    new.name := new.full_name;
  elsif coalesce(nullif(trim(new.name), ''), '') = ''
        and coalesce(nullif(trim(new.full_name), ''), '') <> '' then
    new.name := new.full_name;
  elsif coalesce(nullif(trim(new.full_name), ''), '') = ''
        and coalesce(nullif(trim(new.name), ''), '') <> '' then
    new.full_name := new.name;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_marketplace_profile_names on public.profiles;
create trigger trg_sync_marketplace_profile_names
  before insert or update on public.profiles
  for each row execute function public.sync_marketplace_profile_names();

-- 5) Identity guard: only touch is_verified/role when those columns exist
create or replace function public.enforce_profile_identity_guard()
returns trigger
language plpgsql
as $$
declare
  v_has_is_verified boolean;
begin
  if current_setting('puddle.bypass_identity_guard', true) = 'on' then
    return new;
  end if;

  select count(*) > 0 into v_has_is_verified
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_verified';

  if tg_op = 'UPDATE'
     and auth.uid() is not null
     and auth.uid() = old.id
     and not public.is_admin() then
    if new.role is distinct from old.role then
      new.role := old.role;
    end if;
    if v_has_is_verified and new.is_verified is distinct from old.is_verified then
      new.is_verified := old.is_verified;
    end if;
  end if;

  return new;
end;
$$;

-- 6) Schema-aware sync used by marketplace ensureUserProfile.
-- Does NOT force role 'student' -> 'user' (study-hub keeps 'student').
create or replace function public.sync_profile_identity()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_verified boolean := false;
  v_role_admin boolean := false;
  v_profile public.profiles;
  v_has_email boolean;
  v_has_is_verified boolean;
  v_has_name boolean;
  v_has_full_name boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = 'admin@usm.my' then
    v_verified := true;
    v_role_admin := true;
  elsif v_email like '%@student.usm.my' then
    v_verified := true;
  end if;

  select count(*) > 0 into v_has_email
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email';
  select count(*) > 0 into v_has_is_verified
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_verified';
  select count(*) > 0 into v_has_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'name';
  select count(*) > 0 into v_has_full_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name';

  perform set_config('puddle.bypass_identity_guard', 'on', true);

  if v_has_email and v_has_is_verified then
    update public.profiles
    set
      email = coalesce(nullif(v_email, ''), email),
      is_verified = case
        when role = 'admin' or v_role_admin then true
        else v_verified
      end,
      role = case when v_role_admin then 'admin' else role end
    where id = v_uid;
  elsif v_role_admin then
    update public.profiles
    set role = 'admin'
    where id = v_uid;
  end if;

  if v_has_name and v_has_full_name then
    update public.profiles
    set
      name = case
        when coalesce(nullif(trim(name), ''), '') = '' then full_name
        else name
      end,
      full_name = case
        when coalesce(nullif(trim(full_name), ''), '') = '' then name
        else full_name
      end
    where id = v_uid;
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    perform set_config('puddle.bypass_identity_guard', 'off', true);
    raise exception 'Profile not found';
  end if;

  perform set_config('puddle.bypass_identity_guard', 'off', true);

  return v_profile;
end;
$$;

grant execute on function public.sync_profile_identity() to authenticated;

-- 7) complete_deal: use name or full_name for purchase history labels
create or replace function public.complete_deal(p_deal_id uuid)
returns public.deals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_deal public.deals;
  v_product public.products%rowtype;
  v_buyer_name text;
  v_seller_name text;
  v_purchase_id uuid;
  v_has_full_name boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_deal from public.deals where id = p_deal_id for update;
  if not found then
    raise exception 'Deal not found';
  end if;
  if v_uid <> v_deal.seller_id and not public.is_admin() then
    raise exception 'Only the seller can complete a deal';
  end if;
  if v_deal.status <> 'agreed' then
    raise exception 'Only agreed deals can be completed';
  end if;

  select * into v_product from public.products where id = v_deal.product_id for update;

  select count(*) > 0 into v_has_full_name
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name';

  if v_has_full_name then
    execute $q$
      select coalesce(nullif(trim(name), ''), nullif(trim(full_name), ''), 'Buyer')
      from public.profiles where id = $1
    $q$ into v_buyer_name using v_deal.buyer_id;
    execute $q$
      select coalesce(nullif(trim(name), ''), nullif(trim(full_name), ''), 'Seller')
      from public.profiles where id = $1
    $q$ into v_seller_name using v_deal.seller_id;
  else
    select coalesce(nullif(trim(name), ''), 'Buyer') into v_buyer_name
    from public.profiles where id = v_deal.buyer_id;
    select coalesce(nullif(trim(name), ''), 'Seller') into v_seller_name
    from public.profiles where id = v_deal.seller_id;
  end if;

  update public.deals
  set status = 'completed', updated_at = now()
  where id = p_deal_id
  returning * into v_deal;

  update public.products
  set status = 'sold', reserved_by = null
  where id = v_deal.product_id;

  insert into public.purchases (
    buyer_id,
    seller_id,
    product_name,
    product_image,
    price,
    seller_name,
    buyer_name,
    status,
    product_id,
    deal_id
  )
  values (
    v_deal.buyer_id,
    v_deal.seller_id,
    v_product.name,
    coalesce(v_product.image_urls[1], ''),
    v_product.price,
    coalesce(v_seller_name, 'Seller'),
    coalesce(v_buyer_name, 'Buyer'),
    'Successful',
    v_deal.product_id,
    v_deal.id
  )
  returning id into v_purchase_id;

  update public.deals
  set purchase_id = v_purchase_id
  where id = v_deal.id
  returning * into v_deal;

  insert into public.notifications (user_id, title, message, read, action_url)
  values (
    v_deal.buyer_id,
    'Deal completed',
    format('"%s" marked completed. Pay/meetup was arranged directly — marketplace does not process payments.', v_product.name),
    false,
    '/marketplace/profile'
  );

  return v_deal;
end;
$$;

grant execute on function public.complete_deal(uuid) to authenticated;
