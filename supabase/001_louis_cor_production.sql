-- LOUIS COR ONLY. Apply to a NEW Supabase project, NOT any existing SEZA database.
-- Run in SQL editor after creating the separate project. No products are fabricated.
create extension if not exists pgcrypto;

create table public.lc_store_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check(role in ('owner')),
  added_at timestamptz not null default now()
);
alter table public.lc_store_members enable row level security;
create policy lc_members_own_row on public.lc_store_members for select to authenticated using(user_id=(select auth.uid()));
-- Owner grant MUST be made by a trusted admin via Supabase SQL editor. No client signup.

create or replace function public.lc_is_owner()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lc_store_members where user_id=(select auth.uid()) and role='owner');
$$;
revoke all on function public.lc_is_owner() from public,anon;
grant execute on function public.lc_is_owner() to authenticated;

create table public.lc_products(
 id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id)<=90),
 name text not null check(length(trim(name)) between 2 and 180),
 category text not null,
 audience text not null default 'Unisex' check(audience in ('Men','Women','Unisex')),
 price_cents integer not null check(price_cents>=0),
 compare_at_cents integer check(compare_at_cents>=0),
 description text not null default '',
 materials text not null default '',
 sku text not null default '',
 image_path text,
 image_alt text,
 label text not null default '',
 featured boolean not null default false,
 status text not null default 'draft' check(status in ('draft','active','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.lc_products enable row level security;
create policy lc_products_public_read on public.lc_products for select to anon,authenticated using(status='active');
create policy lc_products_owner_all on public.lc_products for all to authenticated using((select public.lc_is_owner())) with check((select public.lc_is_owner()));

create table public.lc_variants (
 product_id text not null references public.lc_products(id) on delete cascade,
 color text not null check(length(trim(color)) between 1 and 70),
 size text not null check(length(trim(size)) between 1 and 40),
 stock_qty integer not null default 0 check(stock_qty between 0 and 1000000),
 sku text not null default '',
 primary key(product_id,color,size)
);
alter table public.lc_variants enable row level security;
create policy lc_variants_public_read on public.lc_variants for select to anon,authenticated using(exists(select 1 from public.lc_products p where p.id=product_id and p.status='active'));
create policy lc_variants_owner_all on public.lc_variants for all to authenticated using((select public.lc_is_owner())) with check((select public.lc_is_owner()));

create table public.lc_store_settings (
 id integer primary key default 1 check(id=1),
 display_name text not null default 'LOUIS COR',
 legal_business_name text not null default '',
 support_email text not null default '',
 privacy_email text not null default '',
 postal_address text not null default '',
 shipping_regions text not null default '',
 processing_time text not null default '',
 return_window_days integer check(return_window_days between 0 and 365),
 return_address text not null default '',
 return_conditions text not null default '',
 currency text not null default 'usd' check(currency='usd'),
 updated_at timestamptz not null default now()
);
insert into public.lc_store_settings(id) values(1);
alter table public.lc_store_settings enable row level security;
create policy lc_store_settings_read on public.lc_store_settings for select to anon,authenticated using(true);
create policy lc_store_settings_owner_update on public.lc_store_settings for update to authenticated using((select public.lc_is_owner())) with check((select public.lc_is_owner()));

-- Private, payment-verified orders; populated by a future trusted Stripe webhook ONLY.
create table public.lc_orders(
 id uuid primary key default gen_random_uuid(),
 order_number text not null unique,
 stripe_checkout_session_id text unique,
 stripe_payment_intent_id text unique,
 email text not null,
 customer_name text,
 shipping_address jsonb,
 currency text not null default 'usd',
 subtotal_cents integer not null check(subtotal_cents>=0),
 shipping_cents integer not null default 0 check(shipping_cents>=0),
 tax_cents integer not null default 0 check(tax_cents>=0),
 total_cents integer not null check(total_cents>=0),
 payment_status text not null default 'pending' check(payment_status in ('pending','paid','refunded','partially_refunded','failed')),
 fulfillment_status text not null default 'unfulfilled' check(fulfillment_status in ('unfulfilled','shipped','delivered','cancelled')),
 created_at timestamptz not null default now()
);
alter table public.lc_orders enable row level security;
create policy lc_orders_owner_read on public.lc_orders for select to authenticated using((select public.lc_is_owner()));

create table public.lc_order_lines(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.lc_orders(id) on delete cascade,
 product_id text references public.lc_products(id) on delete set null,
 name text not null,
 color text,
 size text,
 sku text,
 unit_price_cents integer not null check(unit_price_cents>=0),
 quantity integer not null check(quantity>0)
);
alter table public.lc_order_lines enable row level security;
create policy lc_order_lines_owner_read on public.lc_order_lines for select to authenticated using((select public.lc_is_owner()));

create table public.lc_shipments(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.lc_orders(id) on delete cascade,
 carrier text not null,
 tracking_code text not null,
 label_storage_path text,
 label_provider_id text,
 state text not null default 'shipped',
 created_at timestamptz not null default now()
);
alter table public.lc_shipments enable row level security;
create policy lc_shipments_owner_read on public.lc_shipments for select to authenticated using((select public.lc_is_owner()));

-- Atomic, owner-authorized product save. Never trusts browser to grant owner rights.
create or replace function public.lc_upsert_product(payload jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare pid text; rec jsonb; count_variants int; seen int;
begin
 if not public.lc_is_owner() then raise exception 'Not authorized'; end if;
 pid:=payload->>'id';
 if pid is null or pid !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(pid)>90 then raise exception 'Invalid product ID'; end if;
 if length(trim(coalesce(payload->>'name',''))) not between 2 and 180 then raise exception 'Invalid product name'; end if;
 if (payload->>'price_cents') !~ '^[0-9]+$' or (payload->>'price_cents')::numeric>200000000 then raise exception 'Invalid product price'; end if;
 if coalesce(payload->>'status','') not in ('draft','active','archived') then raise exception 'Invalid status'; end if;
 if coalesce(payload->>'audience','') not in ('Men','Women','Unisex') then raise exception 'Invalid audience'; end if;
 if length(coalesce(payload->>'category',''))<2 then raise exception 'Category required'; end if;
 if jsonb_typeof(payload->'variants') is distinct from 'array' then raise exception 'Variants must be a list'; end if;
 count_variants:=jsonb_array_length(payload->'variants');
 if count_variants<1 or count_variants>120 then raise exception '1 to 120 variants required'; end if;
 for rec in select value from jsonb_array_elements(payload->'variants') loop
   if length(trim(coalesce(rec->>'color',''))) not between 1 and 70 or length(trim(coalesce(rec->>'size',''))) not between 1 and 40 then raise exception 'Invalid variant'; end if;
   if (rec->>'stock_qty') !~ '^[0-9]+$' or (rec->>'stock_qty')::numeric>1000000 then raise exception 'Invalid stock'; end if;
 end loop;
 select count(*) into seen from (select value->>'color' as c,value->>'size' as s from jsonb_array_elements(payload->'variants') group by 1,2) as v;
 if seen<>count_variants then raise exception 'Duplicate variants'; end if;
 insert into public.lc_products(id,name,category,audience,price_cents,compare_at_cents,description,materials,sku,image_path,image_alt,label,featured,status)
 values(pid,trim(payload->>'name'),payload->>'category',payload->>'audience',(payload->>'price_cents')::int,nullif(payload->>'compare_at_cents','')::integer,coalesce(payload->>'description',''),coalesce(payload->>'materials',''),coalesce(payload->>'sku',''),nullif(payload->>'image_path',''),coalesce(payload->>'image_alt',''),coalesce(payload->>'label',''),coalesce((payload->>'featured')::boolean,false),payload->>'status')
 on conflict(id) do update set name=excluded.name,category=excluded.category,audience=excluded.audience,price_cents=excluded.price_cents,compare_at_cents=excluded.compare_at_cents,description=excluded.description,materials=excluded.materials,sku=excluded.sku,image_path=excluded.image_path,image_alt=excluded.image_alt,label=excluded.label,featured=excluded.featured,status=excluded.status,updated_at=now();
 -- Upsert matching keys to preserve variant identity; remove only obsolete combinations.
 for rec in select value from jsonb_array_elements(payload->'variants') loop
   insert into public.lc_variants(product_id,color,size,stock_qty,sku) values(pid,trim(rec->>'color'),trim(rec->>'size'),(rec->>'stock_qty')::int,coalesce(rec->>'sku',''))
   on conflict(product_id,color,size) do update set stock_qty=excluded.stock_qty,sku=excluded.sku;
 end loop;
 delete from public.lc_variants v where v.product_id=pid and not exists(
   select 1 from jsonb_array_elements(payload->'variants') e where e->>'color'=v.color and e->>'size'=v.size);
 return pid;
end; $$;
revoke all on function public.lc_upsert_product(jsonb) from public,anon;
grant execute on function public.lc_upsert_product(jsonb) to authenticated;

-- Shipment entry by owner, only for payment-confirmed orders. No fake postage purchase.
create or replace function public.lc_record_tracking(order_id uuid,carrier_name text,tracking_number text)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if not public.lc_is_owner() then raise exception 'Not authorized'; end if;
 if length(trim(coalesce(carrier_name,''))) not between 2 and 80 or length(trim(coalesce(tracking_number,''))) not between 5 and 100 then raise exception 'Invalid tracking'; end if;
 if not exists(select 1 from public.lc_orders where id=order_id and payment_status='paid') then raise exception 'A paid order is required'; end if;
 insert into public.lc_shipments(order_id,carrier,tracking_code) values(order_id,trim(carrier_name),trim(tracking_number)) returning id into new_id;
 update public.lc_orders set fulfillment_status='shipped' where id=order_id;
 return new_id;
end; $$;
revoke all on function public.lc_record_tracking(uuid,text,text) from public,anon;
grant execute on function public.lc_record_tracking(uuid,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('lc-product-images','lc-product-images',true,10485760,array['image/jpeg','image/png','image/webp']);
create policy lc_images_read on storage.objects for select to anon,authenticated using(bucket_id='lc-product-images');
create policy lc_images_owner_insert on storage.objects for insert to authenticated with check(bucket_id='lc-product-images' and (select public.lc_is_owner()));
create policy lc_images_owner_update on storage.objects for update to authenticated using(bucket_id='lc-product-images' and (select public.lc_is_owner())) with check(bucket_id='lc-product-images' and (select public.lc_is_owner()));
create policy lc_images_owner_delete on storage.objects for delete to authenticated using(bucket_id='lc-product-images' and (select public.lc_is_owner()));

-- Only after creating a verified user in Supabase Auth, grant owner via SQL editor:
-- insert into public.lc_store_members(user_id,role) values('OWNER_AUTH_UUID','owner');
-- Keep registration/self-service signup disabled. Review Supabase security advisors.
