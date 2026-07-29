-- One-time correction for the existing Articuno product row
update public.products
set category = 'slab',
    updated_at = now()
where id = '6c3a1201-665a-45ca-8d8b-638e0aa65e24';
