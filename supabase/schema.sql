-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  vault_note text,
  condition text,
  category text not null check (category in ('single','slab','sealed')),
  shipping_class text not null check (shipping_class in ('card','sealed')),
  price_cents integer not null check (price_cents > 0),
  quantity integer not null default 1 check (quantity >= 0),
  status text not null default 'draft' check (status in ('draft','active','reserved','sold')),
  image_urls text[] not null default '{}',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique not null,
  stripe_payment_intent_id text,
  customer_email text,
  customer_name text,
  shipping_address jsonb,
  amount_total integer not null default 0,
  shipping_total integer not null default 0,
  status text not null default 'paid',
  product_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.orders enable row level security;

-- Public storefront can only read active, available products.
create policy "Public reads active products"
on public.products for select
using (status = 'active' and quantity > 0);

insert into storage.buckets (id, name, public)
values ('product-images','product-images',true)
on conflict (id) do update set public=true;
