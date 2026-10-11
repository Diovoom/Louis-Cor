-- An internal team member is not a retail customer.
-- Staff classification never grants dashboard or database access.
create table if not exists public.lc_internal_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('developer','staff')),
  created_at timestamptz not null default now()
);
alter table public.lc_internal_accounts enable row level security;
revoke all on public.lc_internal_accounts from anon,authenticated;

create or replace function public.lc_list_customers()
returns table (
 user_id uuid,email text,full_name text,phone text,marketing_opt_in boolean,
 created_at timestamptz,order_count bigint,total_spent_cents bigint
)
language plpgsql security definer set search_path='' as $$
begin
 if not public.lc_is_owner() then raise exception 'Not authorized'; end if;
 return query
 select u.id,u.email::text,coalesce(p.full_name,''),coalesce(p.phone,''),
        coalesce(p.marketing_opt_in,false),u.created_at,
        count(o.id)::bigint,
        coalesce(sum(case when o.payment_status='paid' then o.total_cents else 0 end),0)::bigint
 from auth.users u
 join public.lc_customer_profiles p on p.user_id=u.id
 left join public.lc_orders o on o.customer_user_id=u.id
 where (
    coalesce(u.raw_user_meta_data->>'account_type','')='customer'
    or exists(select 1 from public.lc_orders old_o where old_o.customer_user_id=u.id)
   )
   and not exists(select 1 from public.lc_store_members m where m.user_id=u.id)
   and not exists(select 1 from public.lc_internal_accounts a where a.user_id=u.id)
   and not exists(select 1 from public.lc_owner_invitations i where i.email=lower(u.email))
 group by u.id,u.email,p.full_name,p.phone,p.marketing_opt_in,u.created_at
 order by u.created_at desc;
end; $$;
revoke all on function public.lc_list_customers() from public,anon;
grant execute on function public.lc_list_customers() to authenticated;

create or replace function public.lc_mark_internal_account(target_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.lc_is_owner() then raise exception 'Not authorized'; end if;
 if target_user_id is null or not exists(select 1 from auth.users where id=target_user_id) then
  raise exception 'Unknown account';
 end if;
 insert into public.lc_internal_accounts(user_id,role)
 values(target_user_id,'developer')
 on conflict(user_id) do update set role=excluded.role;
end; $$;
revoke all on function public.lc_mark_internal_account(uuid) from public,anon;
grant execute on function public.lc_mark_internal_account(uuid) to authenticated;

-- Revenue is a server-calculated aggregate across the full date range.
-- It deliberately excludes refunds/partial refunds, for which an exact net amount is not yet tracked.
create or replace function public.lc_sales_summary(start_utc timestamptz,end_utc timestamptz)
returns table (paid_orders bigint,paid_total_cents bigint,partially_refunded_orders bigint,refunded_orders bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not public.lc_is_owner() then raise exception 'Not authorized'; end if;
 if start_utc is null or end_utc is null or start_utc >= end_utc
    or end_utc-start_utc > interval '10 years' then raise exception 'Invalid date range'; end if;
 return query
 select count(*) filter (where o.payment_status='paid')::bigint,
        coalesce(sum(o.total_cents) filter (where o.payment_status='paid'),0)::bigint,
        count(*) filter (where o.payment_status='partially_refunded')::bigint,
        count(*) filter (where o.payment_status='refunded')::bigint
 from public.lc_orders o where o.created_at>=start_utc and o.created_at<end_utc;
end; $$;
revoke all on function public.lc_sales_summary(timestamptz,timestamptz) from public,anon;
grant execute on function public.lc_sales_summary(timestamptz,timestamptz) to authenticated;
