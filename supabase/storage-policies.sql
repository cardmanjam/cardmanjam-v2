-- Supabase Storage policies for product images
-- 1) Allow authenticated users to upload into the public product-images bucket
create policy if not exists "authenticated users can upload product images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
);

-- 2) Allow public read access to all objects in the public product-images bucket
create policy if not exists "public can read product images"
on storage.objects for select
to public
using (
  bucket_id = 'product-images'
);

-- 3) Do not grant anonymous upload access; no insert policy for anon is created.
