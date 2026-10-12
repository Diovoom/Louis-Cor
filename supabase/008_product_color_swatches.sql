-- Safe to reapply. Extend owner-controlled catalog swatches without changing existing stock.
ALTER TABLE public.lc_products
  ADD COLUMN IF NOT EXISTS color_swatches jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.lc_upsert_product(payload jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if jsonb_typeof(coalesce(payload->'color_swatches','{}'::jsonb)) <> 'object' then raise exception 'Invalid color swatches'; end if;
 if exists(select 1 from jsonb_each_text(coalesce(payload->'color_swatches','{}'::jsonb)) as s(label,colorhex)
    where length(s.label)>70 or s.colorhex !~ '^#[0-9A-Fa-f]{6}$') then
   raise exception 'Invalid color swatches';
 end if;
 if jsonb_typeof(payload->'variants') is distinct from 'array' then raise exception 'Variants must be a list'; end if;
 count_variants:=jsonb_array_length(payload->'variants');
 if count_variants<1 or count_variants>120 then raise exception '1 to 120 variants required'; end if;
 for rec in select value from jsonb_array_elements(payload->'variants') loop
   if length(trim(coalesce(rec->>'color',''))) not between 1 and 70 or length(trim(coalesce(rec->>'size',''))) not between 1 and 40 then raise exception 'Invalid variant'; end if;
   if (rec->>'stock_qty') !~ '^[0-9]+$' or (rec->>'stock_qty')::numeric>1000000 then raise exception 'Invalid stock'; end if;
 end loop;
 select count(*) into seen from (
   select value->>'color' as c,value->>'size' as s
   from jsonb_array_elements(payload->'variants') group by 1,2
 ) as v;
 if seen<>count_variants then raise exception 'Duplicate variants'; end if;
 insert into public.lc_products(id,name,category,audience,price_cents,compare_at_cents,
   description,materials,sku,image_path,image_alt,label,featured,status,color_swatches)
 values(pid,trim(payload->>'name'),payload->>'category',payload->>'audience',
   (payload->>'price_cents')::int,nullif(payload->>'compare_at_cents','')::integer,
   coalesce(payload->>'description',''),coalesce(payload->>'materials',''),
   coalesce(payload->>'sku',''),nullif(payload->>'image_path',''),
   coalesce(payload->>'image_alt',''),coalesce(payload->>'label',''),
   coalesce((payload->>'featured')::boolean,false),payload->>'status',
   coalesce(payload->'color_swatches','{}'::jsonb))
 on conflict(id) do update set
   name=excluded.name,category=excluded.category,audience=excluded.audience,
   price_cents=excluded.price_cents,compare_at_cents=excluded.compare_at_cents,
   description=excluded.description,materials=excluded.materials,sku=excluded.sku,
   image_path=excluded.image_path,image_alt=excluded.image_alt,
   label=excluded.label,featured=excluded.featured,status=excluded.status,
   color_swatches=excluded.color_swatches,updated_at=now();
 for rec in select value from jsonb_array_elements(payload->'variants') loop
   insert into public.lc_variants(product_id,color,size,stock_qty,sku)
   values(pid,trim(rec->>'color'),trim(rec->>'size'),(rec->>'stock_qty')::int,coalesce(rec->>'sku',''))
   on conflict(product_id,color,size) do update set stock_qty=excluded.stock_qty,sku=excluded.sku;
 end loop;
 delete from public.lc_variants v where v.product_id=pid and not exists(
   select 1 from jsonb_array_elements(payload->'variants') e
   where e->>'color'=v.color and e->>'size'=v.size);
 return pid;
end; $function$;
