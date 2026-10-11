create table public.lc_customer_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '' check(char_length(full_name)<=120),
 phone text not null default '' check(char_length(phone)<=32),
 marketing_opt_in boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.lc_customer_profiles enable row level security;
create policy lc_customer_profiles_select_self on public.lc_customer_profiles for select to authenticated using(user_id=(select auth.uid()));
create policy lc_customer_profiles_insert_self on public.lc_customer_profiles for insert to authenticated with check(user_id=(select auth.uid()));
create policy lc_customer_profiles_update_self on public.lc_customer_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.lc_customer_addresses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 label text not null default 'Home' check(char_length(label) between 1 and 40),
 recipient text not null check(char_length(recipient) between 2 and 120),
 line1 text not null check(char_length(line1) between 3 and 180),
 line2 text not null default '' check(char_length(line2)<=180),
 city text not null check(char_length(city) between 2 and 120),
 region text not null check(char_length(region) between 2 and 80),
 postal_code text not null check(char_length(postal_code) between 2 and 20),
 country text not null default 'US' check(country ~ '^[A-Z]{2}$'),
 phone text not null default '' check(char_length(phone)<=32),
 is_default boolean not null default false,
 created_at timestamptz not null default now()
);
create index lc_customer_addresses_user_id_idx on public.lc_customer_addresses(user_id);
alter table public.lc_customer_addresses enable row level security;
create policy lc_customer_addresses_own on public.lc_customer_addresses for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.lc_customer_wishlist (
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id text not null references public.lc_products(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,product_id)
);
alter table public.lc_customer_wishlist enable row level security;
create policy lc_customer_wishlist_own on public.lc_customer_wishlist for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.lc_customer_cart (
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id text not null references public.lc_products(id) on delete cascade,
 color text not null,
 size text not null,
 quantity integer not null check(quantity between 1 and 99),
 modified_at timestamptz not null default now(),
 primary key(user_id,product_id,color,size)
);
alter table public.lc_customer_cart enable row level security;
create policy lc_customer_cart_own on public.lc_customer_cart for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

alter table public.lc_orders add column customer_user_id uuid references auth.users(id) on delete set null;
create index lc_orders_customer_user_id_idx on public.lc_orders(customer_user_id);
create policy lc_orders_customer_read on public.lc_orders for select to authenticated using(customer_user_id=(select auth.uid()));
create policy lc_order_lines_customer_read on public.lc_order_lines for select to authenticated using(exists(select 1 from public.lc_orders o where o.id=order_id and o.customer_user_id=(select auth.uid())));
create policy lc_shipments_customer_read on public.lc_shipments for select to authenticated using(exists(select 1 from public.lc_orders o where o.id=order_id and o.customer_user_id=(select auth.uid())));

create or replace function public.lc_create_customer_profile()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.lc_customer_profiles(user_id,full_name)
 values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),120))
 on conflict(user_id) do nothing;
 return new;
end; $$;
revoke all on function public.lc_create_customer_profile() from public,anon,authenticated;
create trigger lc_create_customer_profile_after_signup after insert on auth.users for each row execute function public.lc_create_customer_profile();

create or replace function public.lc_list_customers()
returns table(user_id uuid,email text,full_name text,phone text,marketing_opt_in boolean,created_at timestamptz,order_count bigint,total_spent_cents bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not public.lc_is_owner() then raise exception 'Not authorized'; end if;
 return query
 select u.id,u.email::text,coalesce(p.full_name,''),coalesce(p.phone,''),coalesce(p.marketing_opt_in,false),u.created_at,
        count(o.id)::bigint,coalesce(sum(case when o.payment_status='paid' then o.total_cents else 0 end),0)::bigint
 from auth.users u join public.lc_customer_profiles p on p.user_id=u.id
 left join public.lc_orders o on o.customer_user_id=u.id
 group by u.id,u.email,p.full_name,p.phone,p.marketing_opt_in,u.created_at
 order by u.created_at desc;
end; $$;
revoke all on function public.lc_list_customers() from public,anon;
grant execute on function public.lc_list_customers() to authenticated;
