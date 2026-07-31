create extension if not exists pgcrypto;

create or replace function public.require_service_role()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text unique,
  product_ids uuid[] not null default '{}',
  product_details jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'paid', 'released', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory_reservations enable row level security;

create index if not exists inventory_reservations_expires_at_idx
  on public.inventory_reservations (expires_at);

alter table public.orders
  add column if not exists receipt_url text,
  add column if not exists fulfillment_status text not null default 'unfulfilled',
  add column if not exists shipping_carrier text,
  add column if not exists tracking_number text,
  add column if not exists product_details jsonb not null default '[]'::jsonb;

do $$
begin
  alter table public.orders
    add constraint orders_status_check
    check (status in ('paid', 'manual_review'));
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.orders
    add constraint orders_fulfillment_status_check
    check (fulfillment_status in ('unfulfilled', 'label_created', 'shipped', 'delivered'));
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.reserve_checkout_inventory(requested_product_ids uuid[])
returns table (
  reservation_id uuid,
  expires_at timestamptz,
  product_ids uuid[],
  product_details jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_product_ids uuid[];
  reservation_expires_at timestamptz := now() + interval '35 minutes';
  product_snapshot jsonb;
  unavailable_title text;
  existing_count integer;
begin
  perform public.require_service_role();

  select coalesce(array_agg(distinct product_id order by product_id), '{}'::uuid[])
    into normalized_product_ids
  from unnest(coalesce(requested_product_ids, '{}'::uuid[])) as product_id;

  if coalesce(array_length(normalized_product_ids, 1), 0) = 0 then
    raise exception 'Cart is empty.' using errcode = '22023';
  end if;

  select count(*)
    into existing_count
  from public.products
  where id = any(normalized_product_ids);

  if existing_count <> coalesce(array_length(normalized_product_ids, 1), 0) then
    raise exception 'One or more products no longer exist.' using errcode = 'P0001';
  end if;

  perform 1
  from public.products
  where id = any(normalized_product_ids)
  order by id
  for update;

  select p.title
    into unavailable_title
  from public.products p
  where p.id = any(normalized_product_ids)
    and (p.status <> 'active' or p.quantity <= 0)
  order by p.id
  limit 1;

  if unavailable_title is not null then
    raise exception '% is already reserved or sold.', unavailable_title using errcode = 'P0001';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'price_cents', p.price_cents,
        'category', p.category,
        'shipping_class', p.shipping_class
      )
      order by p.id
    ),
    '[]'::jsonb
  )
    into product_snapshot
  from public.products p
  where p.id = any(normalized_product_ids);

  update public.products p
  set quantity = p.quantity - 1,
      status = case when p.quantity - 1 = 0 then 'reserved' else 'active' end,
      updated_at = now()
  where p.id = any(normalized_product_ids);

  insert into public.inventory_reservations (product_ids, product_details, status, expires_at, created_at, updated_at)
  values (normalized_product_ids, product_snapshot, 'pending', reservation_expires_at, now(), now())
  returning id, expires_at, product_ids, product_details
  into reservation_id, expires_at, product_ids, product_details;

  return next;
end;
$$;

create or replace function public.release_checkout_inventory(reservation_id uuid, new_status text default 'released')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation record;
  release_status text := case when new_status = 'expired' then 'expired' else 'released' end;
begin
  perform public.require_service_role();

  select *
    into reservation
  from public.inventory_reservations
  where id = reservation_id
  for update;

  if not found or reservation.status in ('released', 'expired') then
    return;
  end if;

  update public.products p
  set quantity = p.quantity + 1,
      status = 'active',
      updated_at = now()
  where p.id = any(reservation.product_ids);

  update public.inventory_reservations
  set status = release_status,
      updated_at = now()
  where id = reservation_id;
end;
$$;

create or replace function public.finalize_reserved_checkout(
  reservation_id uuid,
  stripe_session_id text,
  stripe_payment_intent_id text,
  customer_email text,
  customer_name text,
  shipping_address jsonb,
  amount_total integer,
  shipping_total integer,
  receipt_url text,
  product_details jsonb,
  product_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation record;
  order_id uuid;
  order_status text := 'paid';
  reservation_status text := 'missing';
  final_product_ids uuid[] := coalesce(product_ids, '{}'::uuid[]);
  final_product_details jsonb := coalesce(product_details, '[]'::jsonb);
begin
  perform public.require_service_role();

  select *
    into reservation
  from public.inventory_reservations
  where id = reservation_id
  for update;

  if found then
    reservation_status := reservation.status;
    final_product_ids := coalesce(reservation.product_ids, final_product_ids);
    final_product_details := coalesce(reservation.product_details, final_product_details);

    if reservation.status in ('released', 'expired') then
      order_status := 'manual_review';
    else
      if reservation.stripe_checkout_session_id is null then
        update public.inventory_reservations
        set stripe_checkout_session_id = stripe_session_id,
            status = 'paid',
            updated_at = now()
        where id = reservation_id;
      else
        update public.inventory_reservations
        set status = 'paid',
            updated_at = now()
        where id = reservation_id;
      end if;
    end if;
  else
    order_status := 'manual_review';
  end if;

  insert into public.orders (
    stripe_session_id,
    stripe_payment_intent_id,
    customer_email,
    customer_name,
    shipping_address,
    amount_total,
    shipping_total,
    status,
    product_ids,
    product_details,
    receipt_url,
    fulfillment_status,
    shipping_carrier,
    tracking_number
  )
  values (
    stripe_session_id,
    stripe_payment_intent_id,
    customer_email,
    customer_name,
    shipping_address,
    amount_total,
    shipping_total,
    order_status,
    final_product_ids,
    final_product_details,
    receipt_url,
    'unfulfilled',
    null,
    null
  )
  on conflict (stripe_session_id) do update
  set stripe_payment_intent_id = coalesce(public.orders.stripe_payment_intent_id, excluded.stripe_payment_intent_id),
      customer_email = coalesce(public.orders.customer_email, excluded.customer_email),
      customer_name = coalesce(public.orders.customer_name, excluded.customer_name),
      shipping_address = coalesce(public.orders.shipping_address, excluded.shipping_address),
      amount_total = greatest(public.orders.amount_total, excluded.amount_total),
      shipping_total = greatest(public.orders.shipping_total, excluded.shipping_total),
      status = case when public.orders.status = 'manual_review' then public.orders.status else excluded.status end,
      product_ids = case when coalesce(array_length(public.orders.product_ids, 1), 0) = 0 then excluded.product_ids else public.orders.product_ids end,
      product_details = case when coalesce(jsonb_array_length(public.orders.product_details), 0) = 0 then excluded.product_details else public.orders.product_details end,
      receipt_url = coalesce(public.orders.receipt_url, excluded.receipt_url),
      fulfillment_status = coalesce(public.orders.fulfillment_status, excluded.fulfillment_status),
      shipping_carrier = coalesce(public.orders.shipping_carrier, excluded.shipping_carrier),
      tracking_number = coalesce(public.orders.tracking_number, excluded.tracking_number)
  returning id into order_id;

  return jsonb_build_object(
    'order_id', order_id,
    'status', order_status,
    'reservation_status', reservation_status
  );
end;
$$;

create or replace function public.finalize_legacy_checkout(
  stripe_session_id text,
  stripe_payment_intent_id text,
  customer_email text,
  customer_name text,
  shipping_address jsonb,
  amount_total integer,
  shipping_total integer,
  receipt_url text,
  product_details jsonb,
  product_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_product_ids uuid[];
  existing_count integer;
  unavailable_title text;
  order_id uuid;
  order_status text := 'paid';
  final_product_details jsonb := coalesce(product_details, '[]'::jsonb);
begin
  perform public.require_service_role();

  select coalesce(array_agg(distinct product_id order by product_id), '{}'::uuid[])
    into normalized_product_ids
  from unnest(coalesce(product_ids, '{}'::uuid[])) as product_id;

  if coalesce(array_length(normalized_product_ids, 1), 0) = 0 then
    raise exception 'Cart is empty.' using errcode = '22023';
  end if;

  select count(*)
    into existing_count
  from public.products
  where id = any(normalized_product_ids);

  if existing_count <> coalesce(array_length(normalized_product_ids, 1), 0) then
    order_status := 'manual_review';
  else
    perform 1
    from public.products
    where id = any(normalized_product_ids)
    order by id
    for update;

    select p.title
      into unavailable_title
    from public.products p
    where p.id = any(normalized_product_ids)
      and (p.status <> 'active' or p.quantity <= 0)
    order by p.id
    limit 1;

    if unavailable_title is not null then
      order_status := 'manual_review';
    else
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'price_cents', p.price_cents,
            'category', p.category,
            'shipping_class', p.shipping_class
          )
          order by p.id
        ),
        '[]'::jsonb
      )
        into final_product_details
      from public.products p
      where p.id = any(normalized_product_ids);

      update public.products p
      set quantity = p.quantity - 1,
          status = case when p.quantity - 1 = 0 then 'reserved' else 'active' end,
          updated_at = now()
      where p.id = any(normalized_product_ids);
    end if;
  end if;

  insert into public.orders (
    stripe_session_id,
    stripe_payment_intent_id,
    customer_email,
    customer_name,
    shipping_address,
    amount_total,
    shipping_total,
    status,
    product_ids,
    product_details,
    receipt_url,
    fulfillment_status,
    shipping_carrier,
    tracking_number
  )
  values (
    stripe_session_id,
    stripe_payment_intent_id,
    customer_email,
    customer_name,
    shipping_address,
    amount_total,
    shipping_total,
    order_status,
    normalized_product_ids,
    final_product_details,
    receipt_url,
    'unfulfilled',
    null,
    null
  )
  on conflict (stripe_session_id) do update
  set stripe_payment_intent_id = coalesce(public.orders.stripe_payment_intent_id, excluded.stripe_payment_intent_id),
      customer_email = coalesce(public.orders.customer_email, excluded.customer_email),
      customer_name = coalesce(public.orders.customer_name, excluded.customer_name),
      shipping_address = coalesce(public.orders.shipping_address, excluded.shipping_address),
      amount_total = greatest(public.orders.amount_total, excluded.amount_total),
      shipping_total = greatest(public.orders.shipping_total, excluded.shipping_total),
      status = case when public.orders.status = 'manual_review' then public.orders.status else excluded.status end,
      product_ids = case when coalesce(array_length(public.orders.product_ids, 1), 0) = 0 then excluded.product_ids else public.orders.product_ids end,
      product_details = case when coalesce(jsonb_array_length(public.orders.product_details), 0) = 0 then excluded.product_details else public.orders.product_details end,
      receipt_url = coalesce(public.orders.receipt_url, excluded.receipt_url),
      fulfillment_status = coalesce(public.orders.fulfillment_status, excluded.fulfillment_status),
      shipping_carrier = coalesce(public.orders.shipping_carrier, excluded.shipping_carrier),
      tracking_number = coalesce(public.orders.tracking_number, excluded.tracking_number)
  returning id into order_id;

  return jsonb_build_object(
    'order_id', order_id,
    'status', order_status,
    'reservation_status', 'legacy'
  );
end;
$$;

revoke all on function public.require_service_role() from public;
revoke all on function public.reserve_checkout_inventory(uuid[]) from public;
revoke all on function public.release_checkout_inventory(uuid, text) from public;
revoke all on function public.finalize_reserved_checkout(uuid, text, text, text, text, jsonb, integer, integer, text, jsonb, uuid[]) from public;
revoke all on function public.finalize_legacy_checkout(text, text, text, text, jsonb, integer, integer, text, jsonb, uuid[]) from public;

grant execute on function public.require_service_role() to service_role;
grant execute on function public.reserve_checkout_inventory(uuid[]) to service_role;
grant execute on function public.release_checkout_inventory(uuid, text) to service_role;
grant execute on function public.finalize_reserved_checkout(uuid, text, text, text, text, jsonb, integer, integer, text, jsonb, uuid[]) to service_role;
grant execute on function public.finalize_legacy_checkout(text, text, text, text, jsonb, integer, integer, text, jsonb, uuid[]) to service_role;