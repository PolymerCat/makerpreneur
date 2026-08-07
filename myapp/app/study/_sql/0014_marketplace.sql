-- 0014_marketplace.sql
-- USM Marketplace (ported from "Puddle USM" CMT322 project): campus buy/sell.
-- All tables are shared across authenticated users; ownership is enforced by
-- auth.uid()-scoped RLS. NOTE: chat rows live in `mp_messages` (the study
-- hub already owns `public.messages` for study conversations).
-- Apply manually in the Supabase SQL editor (there is no migration runner).
-- If your `profiles` table was created by the study hub (full_name / student role),
-- also run 0020_marketplace_profiles_bridge.sql so marketplace can read seller
-- names and write profile fields (name, avatar, QR, payment note).
-- The image_uploads Storage bucket is created at the bottom of this file.

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  avatar_url text not null default '',
  is_verified boolean not null default false,
  role text not null default 'user',
  qr_code_url text,
  payment_note text,
  created_at timestamptz not null default now(),
  constraint profiles_payment_note_len
    check (payment_note is null or char_length(payment_note) <= 120),
  constraint profiles_role_check
    check (role in ('user', 'admin'))
);

-- Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(12, 2) not null,
  category_id text not null,
  category_name text not null,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  image_urls text[] not null default '{}',
  condition text not null default 'good',
  status text not null default 'available',
  reserved_by uuid references public.profiles (id) on delete set null,
  status_updated_at timestamptz not null default now(),
  date_added timestamptz not null default now(),
  constraint products_status_check
    check (status in ('available', 'reserved', 'sold', 'hidden')),
  constraint products_condition_check
    check (condition in ('new', 'like_new', 'good', 'fair'))
);

create index if not exists products_seller_id_idx on public.products (seller_id);
create index if not exists products_date_added_idx on public.products (date_added desc);
create index if not exists products_status_date_idx on public.products (status, date_added desc);

-- Cart
create table if not exists public.cart_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity int not null default 1,
  status text not null default 'Unpaid',
  date_added timestamptz not null default now(),
  primary key (user_id, product_id),
  constraint cart_items_quantity_one check (quantity = 1)
);

-- Purchases
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  product_name text not null,
  product_image text not null default '',
  price numeric(12, 2) not null,
  seller_name text not null,
  buyer_name text not null,
  purchase_date timestamptz not null default now(),
  status text not null default 'Pending',
  product_id uuid references public.products (id) on delete set null,
  deal_id uuid
);

create index if not exists purchases_buyer_id_idx on public.purchases (buyer_id);
create index if not exists purchases_seller_id_idx on public.purchases (seller_id);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null,
  date timestamptz not null default now(),
  read boolean not null default false,
  action_url text,
  action_type text,
  metadata jsonb
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);

-- Reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  product_name text not null,
  reported_by_id uuid not null references public.profiles (id) on delete cascade,
  reported_by_name text not null,
  reason text not null,
  date timestamptz not null default now(),
  status text not null default 'open',
  resolved_at timestamptz,
  resolver_id uuid references public.profiles (id) on delete set null,
  admin_notes text,
  constraint reports_status_check
    check (status in ('open', 'resolved_hidden', 'resolved_dismissed'))
);

create index if not exists reports_status_date_idx
  on public.reports (status, date desc);

-- Chats (text-id: "<buyerId>-<sellerId>-<productId>")
create table if not exists public.chats (
  id text primary key,
  users uuid[] not null,
  last_message text not null default '',
  last_updated timestamptz not null default now(),
  participants jsonb not null default '{}'::jsonb
);

create index if not exists chats_users_idx on public.chats using gin (users);

-- Messages (renamed mp_messages: hub already owns public.messages)
create table if not exists public.mp_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null references public.chats (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text,
  image_url text,
  timestamp timestamptz not null default now()
);

create index if not exists mp_messages_chat_id_idx on public.mp_messages (chat_id, timestamp);

-- Deals (chat-native deal lifecycle)
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  chat_id text not null references public.chats (id) on delete cascade,
  status text not null default 'interested'
    check (status in ('interested', 'agreed', 'completed', 'cancelled')),
  payment_method text
    check (payment_method is null or payment_method in ('qr', 'bank_transfer', 'cash_meetup')),
  meetup_place text,
  purchase_id uuid references public.purchases (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_buyer_ne_seller check (buyer_id <> seller_id),
  constraint deals_meetup_place_len check (meetup_place is null or char_length(meetup_place) <= 120)
);

do $$
begin
  alter table public.purchases
    add constraint purchases_deal_id_fkey
    foreign key (deal_id) references public.deals (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

create unique index if not exists deals_one_open_per_product
  on public.deals (product_id)
  where status in ('interested', 'agreed');

create index if not exists deals_buyer_idx on public.deals (buyer_id);
create index if not exists deals_seller_idx on public.deals (seller_id);
create index if not exists deals_chat_idx on public.deals (chat_id);
create index if not exists deals_product_idx on public.deals (product_id);

-- Auto-create profile on signup + identity guard
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  or coalesce(auth.jwt() ->> 'email', '') = 'admin@usm.my';
$$;

create or replace function public.enforce_profile_identity_guard()
returns trigger
language plpgsql
as $$
begin
  if current_setting('puddle.bypass_identity_guard', true) = 'on' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and auth.uid() is not null
     and auth.uid() = old.id
     and not public.is_admin()
     and (
       new.role is distinct from old.role
       or new.is_verified is distinct from old.is_verified
     ) then
    new.role := old.role;
    new.is_verified := old.is_verified;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_identity_guard on public.profiles;
create trigger trg_enforce_profile_identity_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_identity_guard();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_verified boolean := false;
  v_role text := 'user';
begin
  if v_email = 'admin@usm.my' then
    v_verified := true;
    v_role := 'admin';
  elsif v_email like '%@student.usm.my' then
    v_verified := true;
  end if;

  perform set_config('puddle.bypass_identity_guard', 'on', true);

  insert into public.profiles (id, name, email, avatar_url, is_verified, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      'https://picsum.photos/seed/' || new.id::text || '/100/100'
    ),
    v_verified,
    v_role
  )
  on conflict (id) do update set
    email = excluded.email,
    name = case when excluded.name <> '' then excluded.name else profiles.name end,
    is_verified = excluded.is_verified,
    role = excluded.role;

  perform set_config('puddle.bypass_identity_guard', 'off', true);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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
  v_role text := 'user';
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if v_email = 'admin@usm.my' then
    v_verified := true;
    v_role := 'admin';
  elsif v_email like '%@student.usm.my' then
    v_verified := true;
  end if;

  perform set_config('puddle.bypass_identity_guard', 'on', true);

  update public.profiles
  set
    email = coalesce(auth.jwt() ->> 'email', email),
    is_verified = case
      when role = 'admin' or v_role = 'admin' then true
      else v_verified
    end,
    role = case
      when role = 'admin' or v_role = 'admin' then 'admin'
      else 'user'
    end
  where id = v_uid
  returning * into v_profile;

  perform set_config('puddle.bypass_identity_guard', 'off', true);

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$$;

grant execute on function public.sync_profile_identity() to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.cart_items enable row level security;
alter table public.purchases enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.chats enable row level security;
alter table public.mp_messages enable row level security;
alter table public.deals enable row level security;

-- Profiles
create policy "Profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Products
create policy "Products are publicly readable"
  on public.products for select using (true);
create policy "Authenticated users can create products"
  on public.products for insert to authenticated with check (auth.uid() = seller_id);
create policy "Sellers or admin can update products"
  on public.products for update to authenticated
  using (auth.uid() = seller_id or public.is_admin());
create policy "Sellers or admin can delete products"
  on public.products for delete to authenticated
  using (auth.uid() = seller_id or public.is_admin());

create or replace function public.enforce_product_status_role()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'hidden' and not public.is_admin() then
    raise exception 'Only admin can hide listings';
  end if;
  if tg_op = 'UPDATE' and (
    new.status is distinct from old.status
    or new.reserved_by is distinct from old.reserved_by
  ) then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_product_status_role on public.products;
create trigger trg_enforce_product_status_role
  before insert or update on public.products
  for each row execute function public.enforce_product_status_role();

-- Cart
create policy "Users manage own cart"
  on public.cart_items for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Purchases
create policy "Buyers and sellers can read purchases"
  on public.purchases for select to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "Authenticated users can create purchases"
  on public.purchases for insert to authenticated
  with check (auth.uid() = buyer_id);
create policy "Sellers or admin can update purchases"
  on public.purchases for update to authenticated
  using (auth.uid() = seller_id or public.is_admin())
  with check (auth.uid() = seller_id or public.is_admin());

-- Notifications
create policy "Users read own notifications"
  on public.notifications for select to authenticated using (auth.uid() = user_id);
-- No open insert policy: notifications are created only via security definer RPCs.
create policy "Users update own notifications"
  on public.notifications for update to authenticated using (auth.uid() = user_id);
create policy "Users delete own notifications"
  on public.notifications for delete to authenticated using (auth.uid() = user_id);

-- Notification RPCs (security definer)
create or replace function public.notify_seller_of_report(
  p_product_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.products%rowtype;
  v_title text;
  v_message text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_reason is null or char_length(trim(p_reason)) < 10 or char_length(p_reason) > 500 then
    raise exception 'Invalid report reason';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'Product not found';
  end if;
  if v_product.seller_id = v_uid then
    raise exception 'Cannot report your own listing';
  end if;

  v_title := 'Your product has been reported';
  v_message := format(
    'Your listing, "%s", has been reported by a user. Our admin team will review it shortly.',
    v_product.name
  );

  if char_length(v_title) > 120 or char_length(v_message) > 500 then
    raise exception 'Notification content too long';
  end if;

  insert into public.notifications (user_id, title, message, read, action_url)
  values (
    v_product.seller_id,
    v_title,
    v_message,
    false,
    format('/products/%s', v_product.id)
  );
end;
$$;

create or replace function public.notify_deal_recorded(
  p_purchase_id uuid,
  p_method text,
  p_product_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_purchase public.purchases%rowtype;
  v_title text;
  v_message text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_method is null or p_method not in ('qr', 'cash_meetup') then
    raise exception 'Invalid deal method';
  end if;

  select * into v_purchase from public.purchases where id = p_purchase_id;
  if not found then
    raise exception 'Purchase not found';
  end if;
  if v_purchase.buyer_id <> v_uid then
    raise exception 'Only the buyer can notify for this deal';
  end if;

  if p_method = 'cash_meetup' then
    v_title := 'Cash meetup request';
    v_message := format(
      'A buyer requested a cash meetup for "%s". Confirm only after you complete the meetup and receive cash. Puddle does not verify payments.',
      v_purchase.product_name
    );
  else
    v_title := 'Deal confirmation requested';
    v_message := format(
      'A buyer recorded a deal for "%s" and will pay you directly (QR/bank). Confirm only after you receive payment. Puddle does not verify payments.',
      v_purchase.product_name
    );
  end if;

  if char_length(v_title) > 120 or char_length(v_message) > 500 then
    raise exception 'Notification content too long';
  end if;

  insert into public.notifications (
    user_id, title, message, read, action_url, action_type, metadata
  )
  values (
    v_purchase.seller_id,
    v_title,
    v_message,
    false,
    '/inbox',
    'confirm_transaction',
    jsonb_build_object(
      'buyerId', v_purchase.buyer_id,
      'productId', coalesce(p_product_id, v_purchase.product_id),
      'purchaseId', v_purchase.id
    )
  );
end;
$$;

create or replace function public.notify_admin_deleted_listing(
  p_product_id uuid,
  p_product_name text,
  p_seller_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := 'Your product has been removed';
  v_message text;
begin
  if not public.is_admin() then
    raise exception 'Only admin can send this notification';
  end if;

  if p_seller_id is null or p_product_name is null or trim(p_product_name) = '' then
    raise exception 'Missing listing details';
  end if;

  v_message := format(
    'Your listing, "%s", was removed by an administrator.',
    left(p_product_name, 200)
  );

  if char_length(v_title) > 120 or char_length(v_message) > 500 then
    raise exception 'Notification content too long';
  end if;

  insert into public.notifications (user_id, title, message, read, action_url)
  values (
    p_seller_id,
    v_title,
    v_message,
    false,
    null
  );
end;
$$;

grant execute on function public.notify_seller_of_report(uuid, text) to authenticated;
grant execute on function public.notify_deal_recorded(uuid, text, uuid) to authenticated;
grant execute on function public.notify_admin_deleted_listing(uuid, text, uuid) to authenticated;

-- Reports
create policy "Admin can read reports"
  on public.reports for select to authenticated using (public.is_admin());
create policy "Authenticated users can create reports"
  on public.reports for insert to authenticated with check (auth.uid() = reported_by_id);
create policy "Admin can update reports"
  on public.reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy "Admin can delete reports"
  on public.reports for delete to authenticated using (public.is_admin());

-- Admin RPCs
create or replace function public.admin_hide_listing(p_report_id uuid)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports;
  v_product public.products%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admin can hide listings';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found';
  end if;
  if v_report.status <> 'open' then
    raise exception 'Report is already resolved';
  end if;

  select * into v_product from public.products where id = v_report.product_id for update;
  if not found then
    raise exception 'Product not found';
  end if;

  update public.products
  set status = 'hidden', reserved_by = null
  where id = v_product.id;

  update public.reports
  set
    status = 'resolved_hidden',
    resolved_at = now(),
    resolver_id = auth.uid()
  where product_id = v_report.product_id
    and status = 'open';

  select * into v_report from public.reports where id = p_report_id;

  insert into public.notifications (user_id, title, message, read, action_url)
  values (
    v_product.seller_id,
    'Listing hidden by admin',
    format(
      'Your listing "%s" was hidden after a community report review. It is no longer shown in browse. Contact support if you believe this was a mistake.',
      v_product.name
    ),
    false,
    format('/products/%s', v_product.id)
  );

  return v_report;
end;
$$;

create or replace function public.admin_dismiss_report(p_report_id uuid)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports;
begin
  if not public.is_admin() then
    raise exception 'Only admin can dismiss reports';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found';
  end if;
  if v_report.status <> 'open' then
    raise exception 'Report is already resolved';
  end if;

  update public.reports
  set
    status = 'resolved_dismissed',
    resolved_at = now(),
    resolver_id = auth.uid()
  where id = p_report_id
  returning * into v_report;

  return v_report;
end;
$$;

create or replace function public.admin_restore_listing(p_product_id uuid)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
begin
  if not public.is_admin() then
    raise exception 'Only admin can restore listings';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Product not found';
  end if;
  if v_product.status <> 'hidden' then
    raise exception 'Only hidden listings can be restored';
  end if;

  update public.products
  set status = 'available', reserved_by = null
  where id = p_product_id
  returning * into v_product;

  insert into public.notifications (user_id, title, message, read, action_url)
  values (
    v_product.seller_id,
    'Listing restored',
    format('Your listing "%s" is available in browse again.', v_product.name),
    false,
    format('/products/%s', v_product.id)
  );

  return v_product;
end;
$$;

grant execute on function public.admin_hide_listing(uuid) to authenticated;
grant execute on function public.admin_dismiss_report(uuid) to authenticated;
grant execute on function public.admin_restore_listing(uuid) to authenticated;

-- Chats
create policy "Participants can read chats"
  on public.chats for select to authenticated
  using (auth.uid() = any (users));
create policy "Authenticated users can create chats"
  on public.chats for insert to authenticated
  with check (auth.uid() = any (users));
create policy "Participants can update chats"
  on public.chats for update to authenticated
  using (auth.uid() = any (users));

-- Messages
create policy "Chat participants can read messages"
  on public.mp_messages for select to authenticated
  using (
    exists (
      select 1 from public.chats c
      where c.id = mp_messages.chat_id and auth.uid() = any (c.users)
    )
  );
create policy "Chat participants can insert messages"
  on public.mp_messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.chats c
      where c.id = chat_id and auth.uid() = any (c.users)
    )
  );

-- Deals RLS
create policy "Deal participants read"
  on public.deals for select to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "Buyer creates interested deal"
  on public.deals for insert to authenticated
  with check (
    auth.uid() = buyer_id
    and status = 'interested'
    and buyer_id <> seller_id
  );
create policy "Participants update deals"
  on public.deals for update to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Deal transition + sold-sync triggers
create or replace function public.enforce_deal_status_transition()
returns trigger
language plpgsql
as $$
begin
  if current_setting('puddle.bypass_deal_guard', true) = 'on' then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'interested' then
      raise exception 'New deals must start as interested';
    end if;
    if auth.uid() is distinct from new.buyer_id then
      raise exception 'Only the buyer can create a deal';
    end if;
    return new;
  end if;

  if old.status = new.status then
    new.updated_at := now();
    return new;
  end if;

  if old.status in ('completed', 'cancelled') then
    raise exception 'Deal is already closed';
  end if;

  if new.status = 'agreed' then
    if old.status <> 'interested' then
      raise exception 'Only interested deals can be agreed';
    end if;
    if auth.uid() is distinct from old.seller_id and not public.is_admin() then
      raise exception 'Only the seller can agree a deal';
    end if;
  elsif new.status = 'completed' then
    if old.status <> 'agreed' then
      raise exception 'Only agreed deals can be completed';
    end if;
    if auth.uid() is distinct from old.seller_id and not public.is_admin() then
      raise exception 'Only the seller can complete a deal';
    end if;
  elsif new.status = 'cancelled' then
    if old.status not in ('interested', 'agreed') then
      raise exception 'Deal cannot be cancelled';
    end if;
    if auth.uid() is distinct from old.buyer_id
       and auth.uid() is distinct from old.seller_id
       and not public.is_admin() then
      raise exception 'Only deal participants can cancel';
    end if;
  else
    raise exception 'Invalid deal status transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_deal_status_transition on public.deals;
create trigger trg_enforce_deal_status_transition
  before insert or update on public.deals
  for each row execute function public.enforce_deal_status_transition();

create or replace function public.cancel_open_deals_on_product_sold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'sold' and old.status is distinct from 'sold' then
    perform set_config('puddle.bypass_deal_guard', 'on', true);
    update public.deals
    set status = 'cancelled', updated_at = now()
    where product_id = new.id
      and status in ('interested', 'agreed');
    perform set_config('puddle.bypass_deal_guard', 'off', true);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cancel_open_deals_on_product_sold on public.products;
create trigger trg_cancel_open_deals_on_product_sold
  after update of status on public.products
  for each row execute function public.cancel_open_deals_on_product_sold();

-- Deal RPCs
create or replace function public.express_deal_interest(
  p_product_id uuid,
  p_seller_id uuid,
  p_chat_id text
)
returns public.deals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid := auth.uid();
  v_product public.products%rowtype;
  v_deal public.deals;
begin
  if v_buyer is null then
    raise exception 'Not authenticated';
  end if;
  if v_buyer = p_seller_id then
    raise exception 'Cannot create a deal on your own listing';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'Product not found';
  end if;
  if v_product.seller_id <> p_seller_id then
    raise exception 'Seller mismatch';
  end if;
  if v_product.status <> 'available' then
    raise exception 'Item is not available for a new deal';
  end if;

  if not exists (select 1 from public.chats c where c.id = p_chat_id and v_buyer = any (c.users)) then
    raise exception 'Chat not found for this deal';
  end if;

  insert into public.deals (product_id, buyer_id, seller_id, chat_id, status)
  values (p_product_id, v_buyer, p_seller_id, p_chat_id, 'interested')
  returning * into v_deal;

  insert into public.notifications (user_id, title, message, read, action_url)
  values (
    p_seller_id,
    'Buyer interested',
    format('A buyer is interested in "%s". Open chat to agree or cancel.', v_product.name),
    false,
    format('/messages/%s?product=%s', v_buyer, p_product_id)
  );

  return v_deal;
exception
  when unique_violation then
    raise exception 'Someone is already in a deal for this item';
end;
$$;

create or replace function public.agree_deal(p_deal_id uuid)
returns public.deals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_deal public.deals;
  v_product public.products%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_deal from public.deals where id = p_deal_id for update;
  if not found then
    raise exception 'Deal not found';
  end if;
  if v_uid <> v_deal.seller_id and not public.is_admin() then
    raise exception 'Only the seller can agree a deal';
  end if;
  if v_deal.status <> 'interested' then
    raise exception 'Deal cannot be agreed in its current state';
  end if;

  select * into v_product from public.products where id = v_deal.product_id for update;
  if v_product.status not in ('available', 'reserved') then
    raise exception 'Listing is not available to reserve';
  end if;

  update public.deals
  set status = 'agreed', updated_at = now()
  where id = p_deal_id
  returning * into v_deal;

  update public.products
  set status = 'reserved', reserved_by = v_deal.buyer_id
  where id = v_deal.product_id;

  insert into public.notifications (user_id, title, message, read, action_url)
  values (
    v_deal.buyer_id,
    'Deal agreed',
    format('The seller agreed and reserved "%s". Arrange payment and meetup in chat.', v_product.name),
    false,
    format('/messages/%s?product=%s', v_deal.seller_id, v_deal.product_id)
  );

  return v_deal;
end;
$$;

create or replace function public.cancel_deal(p_deal_id uuid)
returns public.deals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_deal public.deals;
  v_product public.products%rowtype;
  v_counterpart uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_deal from public.deals where id = p_deal_id for update;
  if not found then
    raise exception 'Deal not found';
  end if;
  if v_uid <> v_deal.buyer_id and v_uid <> v_deal.seller_id and not public.is_admin() then
    raise exception 'Only deal participants can cancel';
  end if;
  if v_deal.status not in ('interested', 'agreed') then
    raise exception 'Deal is already closed';
  end if;

  select * into v_product from public.products where id = v_deal.product_id for update;

  update public.deals
  set status = 'cancelled', updated_at = now()
  where id = p_deal_id
  returning * into v_deal;

  if v_product.status = 'reserved'
     and (v_product.reserved_by is null or v_product.reserved_by = v_deal.buyer_id) then
    update public.products
    set status = 'available', reserved_by = null
    where id = v_deal.product_id;
  end if;

  v_counterpart := case when v_uid = v_deal.buyer_id then v_deal.seller_id else v_deal.buyer_id end;

  insert into public.notifications (user_id, title, message, read, action_url)
  values (
    v_counterpart,
    'Deal cancelled',
    format('The deal for "%s" was cancelled.', v_product.name),
    false,
    format('/messages/%s?product=%s', v_uid, v_deal.product_id)
  );

  return v_deal;
end;
$$;

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
  v_buyer public.profiles%rowtype;
  v_seller public.profiles%rowtype;
  v_purchase_id uuid;
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
  select * into v_buyer from public.profiles where id = v_deal.buyer_id;
  select * into v_seller from public.profiles where id = v_deal.seller_id;

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
    coalesce(v_seller.name, 'Seller'),
    coalesce(v_buyer.name, 'Buyer'),
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
    format('"%s" marked completed. Pay/meetup was arranged directly — Puddle does not process payments.', v_product.name),
    false,
    '/profile'
  );

  return v_deal;
end;
$$;

grant execute on function public.express_deal_interest(uuid, uuid, text) to authenticated;
grant execute on function public.agree_deal(uuid) to authenticated;
grant execute on function public.cancel_deal(uuid) to authenticated;
grant execute on function public.complete_deal(uuid) to authenticated;

-- Realtime
do $$
begin
  alter publication supabase_realtime add table public.cart_items;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.purchases;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.chats;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.mp_messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.deals;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.reports;
exception when duplicate_object then null;
end $$;

-- Storage bucket + policies for image_uploads. The bucket insert is
-- idempotent: safe to re-run if the bucket was created via Dashboard first.
insert into storage.buckets (id, name, public)
values ('image_uploads', 'image_uploads', true)
on conflict (id) do nothing;

create policy "Public read image_uploads"
  on storage.objects for select
  using (bucket_id = 'image_uploads');

create policy "Authenticated upload image_uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'image_uploads');

create policy "Authenticated update own image_uploads"
  on storage.objects for update to authenticated
  using (bucket_id = 'image_uploads');

create policy "Authenticated delete own image_uploads"
  on storage.objects for delete to authenticated
  using (bucket_id = 'image_uploads');
