-- Add nullable product metadata columns for storefront filters and details.
alter table public.products
  add column if not exists language text,
  add column if not exists grading_company text,
  add column if not exists grade text;
