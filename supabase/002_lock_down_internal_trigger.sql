-- Already applied to the LOUIS COR Supabase project on October 11, 2026.
-- Keep for the source-controlled record; do not run again on this project.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
comment on function public.lc_upsert_product(jsonb) is 'Authenticated owner only: authorization checked inside before changes; product and variants saved atomically.';
comment on function public.lc_record_tracking(uuid,text,text) is 'Authenticated owner only: authorization and paid-order status checked inside.';
comment on function public.lc_is_owner() is 'Authenticated role lookup for RLS policies; intentionally security definer; returns only boolean.';
