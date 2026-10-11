-- Server-managed checkout only. Never grant order writes to browser roles.
create table if not exists public.lc_checkout_reservations (
  order_id uuid primary key references public.lc_orders(id) on delete cascade,
  customer_user_id uuid not null references auth.users(id) on delete restrict,
  items jsonb not null,
  state text not null default 'reserved' check (state in ('reserved','ready','paid','released')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '45 minutes')
);
alter table public.lc_checkout_reservations enable row level security;
revoke all on public.lc_checkout_reservations from anon,authenticated;
create index if not exists lc_checkout_reservations_expiry on public.lc_checkout_reservations(expires_at)
 where state in ('reserved','ready');

create table if not exists public.lc_payment_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
alter table public.lc_payment_webhook_events enable row level security;
revoke all on public.lc_payment_webhook_events from anon,authenticated;

alter table public.lc_orders add column if not exists stripe_refunded_cents integer not null default 0
 check (stripe_refunded_cents >= 0);

create or replace function public.lc_checkout_reserve(buyer_id uuid, cart jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  one jsonb; variant_row record; product_row record;
  qty integer; aggregate_qty integer:=0; subtotal bigint:=0;
  oid uuid:=gen_random_uuid(); order_no text;
  purchase_lines jsonb:='[]'::jsonb; count_lines int;
begin
  if buyer_id is null or not exists (
    select 1 from auth.users where id=buyer_id and email_confirmed_at is not null
  ) then raise exception 'Verified customer account required'; end if;
  if exists(select 1 from public.lc_store_members where user_id=buyer_id) then
    raise exception 'Store accounts cannot purchase through customer checkout';
  end if;
  if jsonb_typeof(cart) <> 'array' then raise exception 'Invalid bag'; end if;
  count_lines:=jsonb_array_length(cart);
  if count_lines < 1 or count_lines > 20 then raise exception 'Bag must contain 1 to 20 items'; end if;
  if exists(
    select 1 from (select x->>'product_id' pid,x->>'color' c,x->>'size' s,
    count(*) n from jsonb_array_elements(cart) x group by 1,2,3 having count(*)>1) duplicates
  ) then raise exception 'Duplicate bag items'; end if;

  -- Lock variants in stable order. Every amount comes from the database, never the browser.
  for one in select value from jsonb_array_elements(cart) as t(value)
    order by value->>'product_id',value->>'color',value->>'size' loop
    if coalesce(one->>'quantity','') !~ '^[1-9][0-9]?$' then raise exception 'Invalid quantity'; end if;
    qty:=(one->>'quantity')::integer;
    aggregate_qty:=aggregate_qty+qty;
    if aggregate_qty>50 then raise exception 'Bag quantity limit exceeded'; end if;
    select p.id,p.name,p.price_cents,p.status into product_row
      from public.lc_products p where p.id=one->>'product_id';
    if not found or product_row.status<>'active' or product_row.price_cents<50 then
      raise exception 'A piece is no longer available'; end if;
    update public.lc_variants v set stock_qty=v.stock_qty-qty
      where v.product_id=product_row.id and v.color=one->>'color'
        and v.size=one->>'size' and v.stock_qty>=qty
      returning v.product_id,v.color,v.size,v.stock_qty into variant_row;
    if not found then raise exception 'A selected size or color is out of stock'; end if;
    subtotal:=subtotal+(product_row.price_cents::bigint * qty);
    if subtotal>200000000 then raise exception 'Order total limit exceeded'; end if;
    purchase_lines:=purchase_lines||jsonb_build_array(jsonb_build_object(
      'product_id',product_row.id,'name',product_row.name,'color',one->>'color',
      'size',one->>'size','quantity',qty,'unit_price_cents',product_row.price_cents
    ));
  end loop;
  order_no:='LC-'||upper(left(replace(oid::text,'-',''),12));
  insert into public.lc_orders(id,order_number,email,customer_user_id,currency,subtotal_cents,total_cents,payment_status)
    select oid,order_no,email,buyer_id,'usd',subtotal::integer,subtotal::integer,'pending'
      from auth.users where id=buyer_id;
  insert into public.lc_order_lines(order_id,product_id,name,color,size,unit_price_cents,quantity)
    select oid,x->>'product_id',x->>'name',x->>'color',x->>'size',
       (x->>'unit_price_cents')::integer,(x->>'quantity')::integer
      from jsonb_array_elements(purchase_lines) as x;
  insert into public.lc_checkout_reservations(order_id,customer_user_id,items)
    values(oid,buyer_id,purchase_lines);
  return jsonb_build_object('order_id',oid,'order_number',order_no,'subtotal_cents',subtotal,'items',purchase_lines);
end; $$;
revoke all on function public.lc_checkout_reserve(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.lc_checkout_reserve(uuid,jsonb) to service_role;

create or replace function public.lc_checkout_attach(oid uuid, sid text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if sid is null or sid !~ '^cs_(test|live)_[a-zA-Z0-9]+$' then raise exception 'Invalid payment session'; end if;
 update public.lc_checkout_reservations set state='ready'
 where order_id=oid and state='reserved' and expires_at>now();
 if not found then raise exception 'Checkout expired'; end if;
 update public.lc_orders set stripe_checkout_session_id=sid where id=oid and payment_status='pending';
 if not found then raise exception 'Order unavailable'; end if;
end; $$;
revoke all on function public.lc_checkout_attach(uuid,text) from public,anon,authenticated;
grant execute on function public.lc_checkout_attach(uuid,text) to service_role;

create or replace function public.lc_checkout_release(oid uuid, sid text default null)
returns text language plpgsql security definer set search_path='' as $$
declare r record; x jsonb;
begin
 select * into r from public.lc_checkout_reservations where order_id=oid for update;
 if not found then return 'not_found'; end if;
 if sid is not null and not exists(
    select 1 from public.lc_orders o where o.id=oid and o.stripe_checkout_session_id=sid
 ) then return 'session_mismatch'; end if;
 if r.state in ('paid','released') then return r.state; end if;
 update public.lc_checkout_reservations set state='released' where order_id=oid;
 for x in select value from jsonb_array_elements(r.items) t(value) loop
   update public.lc_variants v set stock_qty=stock_qty+(x->>'quantity')::integer
    where v.product_id=x->>'product_id' and v.color=x->>'color' and v.size=x->>'size';
 end loop;
 update public.lc_orders set payment_status='failed' where id=oid and payment_status='pending';
 return 'released';
end; $$;
revoke all on function public.lc_checkout_release(uuid,text) from public,anon,authenticated;
grant execute on function public.lc_checkout_release(uuid,text) to service_role;

create or replace function public.lc_checkout_paid(
 oid uuid,sid text,payment_intent text,paid_total integer,shipping_total integer,tax_total integer,address jsonb
) returns text language plpgsql security definer set search_path='' as $$
declare r record; o record;
begin
 select * into r from public.lc_checkout_reservations where order_id=oid for update;
 if not found then raise exception 'Unknown checkout'; end if;
 select * into o from public.lc_orders where id=oid for update;
 if o.stripe_checkout_session_id is distinct from sid then raise exception 'Session does not match order'; end if;
 if r.state='paid' then return 'already_paid'; end if;
 if r.state='released' then raise exception 'Paid event for released checkout requires manual reconciliation'; end if;
 if paid_total is null or shipping_total is null or tax_total is null
    or paid_total<>o.subtotal_cents+shipping_total+tax_total
    or shipping_total<0 or tax_total<0 then raise exception 'Payment totals do not reconcile'; end if;
 update public.lc_orders set payment_status='paid',stripe_payment_intent_id=payment_intent,
    shipping_cents=shipping_total,tax_cents=tax_total,total_cents=paid_total,
    shipping_address=address where id=oid;
 update public.lc_checkout_reservations set state='paid' where order_id=oid;
 return 'paid';
end; $$;
revoke all on function public.lc_checkout_paid(uuid,text,text,integer,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.lc_checkout_paid(uuid,text,text,integer,integer,integer,jsonb) to service_role;

create or replace function public.lc_record_stripe_refund(payment_intent text,refund_total integer)
returns text language plpgsql security definer set search_path='' as $$
declare o record; new_status text;
begin
 select id,total_cents,stripe_refunded_cents into o from public.lc_orders
  where stripe_payment_intent_id=payment_intent for update;
 if not found then return 'not_found'; end if;
 if refund_total<o.stripe_refunded_cents or refund_total>o.total_cents then raise exception 'Invalid refunded total'; end if;
 new_status:=case when refund_total=o.total_cents then 'refunded' else when refund_total>0 then 'partially_refunded' else 'paid' end;
 update public.lc_orders set stripe_refunded_cents=refund_total,payment_status=new_status where id=o.id;
 return new_status;
end; $$;
revoke all on function public.lc_record_stripe_refund(text,integer) from public,anon,authenticated;
grant execute on function public.lc_record_stripe_refund(text,integer) to service_role;

create or replace function public.lc_record_payment_event(eid text,kind text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if eid is null or length(eid)>150 or kind is null then raise exception 'Invalid event'; end if;
 insert into public.lc_payment_webhook_events(stripe_event_id,event_type) values(eid,kind)
 on conflict(stripe_event_id) do nothing;
 return found;
end; $$;
revoke all on function public.lc_record_payment_event(text,text) from public,anon,authenticated;
grant execute on function public.lc_record_payment_event(text,text) to service_role;
