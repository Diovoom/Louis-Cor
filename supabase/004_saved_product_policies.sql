drop policy if exists lc_customer_wishlist_own on public.lc_customer_wishlist;
create policy lc_customer_wishlist_select on public.lc_customer_wishlist for select to authenticated using(user_id=(select auth.uid()));
create policy lc_customer_wishlist_insert on public.lc_customer_wishlist for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.lc_products where id=product_id and status='active'));
create policy lc_customer_wishlist_delete on public.lc_customer_wishlist for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists lc_customer_cart_own on public.lc_customer_cart;
create policy lc_customer_cart_select on public.lc_customer_cart for select to authenticated using(user_id=(select auth.uid()));
create policy lc_customer_cart_insert on public.lc_customer_cart for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.lc_products where id=product_id and status='active'));
create policy lc_customer_cart_update on public.lc_customer_cart for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.lc_products where id=product_id and status='active'));
create policy lc_customer_cart_delete on public.lc_customer_cart for delete to authenticated using(user_id=(select auth.uid()));
