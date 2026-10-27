-- TyM Dulce Clientes: base independiente del punto de venta.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
grant select on public.admin_users to authenticated;
create policy "admin reads own membership" on public.admin_users for select to authenticated using (user_id = auth.uid());

create or replace function public.is_tym_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.admin_users where user_id=auth.uid()); $$;
grant execute on function public.is_tym_admin() to authenticated;

create table if not exists public.products (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 120),
 description text not null default '',
 price numeric(12,2) not null default 0 check(price>=0),
 category text not null default 'Cajas dulces',
 badge text not null default '',
 image_url text,
 image_path text,
 image_position text not null default '50% 50%',
 featured boolean not null default false,
 active boolean not null default true,
 sort_order integer not null default 100,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists products_catalog_idx on public.products(active,sort_order,created_at desc);
alter table public.products enable row level security;
grant select on public.products to anon,authenticated;
grant insert,update,delete on public.products to authenticated;
create policy "public reads active products" on public.products for select to anon,authenticated using(active=true or public.is_tym_admin());
create policy "admins insert products" on public.products for insert to authenticated with check(public.is_tym_admin());
create policy "admins update products" on public.products for update to authenticated using(public.is_tym_admin()) with check(public.is_tym_admin());
create policy "admins delete products" on public.products for delete to authenticated using(public.is_tym_admin());

create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 ticket_code text not null unique,
 customer_name text not null check(length(customer_name) between 2 and 100),
 customer_phone text not null check(length(customer_phone) between 6 and 30),
 fulfillment text not null default 'A coordinar' check(fulfillment in ('A coordinar','Retiro','Entrega')),
 needed_date date,
 notes text not null default '' check(length(notes)<=500),
 items jsonb not null check(jsonb_typeof(items)='array'),
 total numeric(12,2) not null default 0 check(total>=0),
 status text not null default 'pending_validation' check(status in ('pending_validation','validated','contacted','accepted','rejected','completed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status,created_at desc);
alter table public.orders enable row level security;
grant select,update on public.orders to authenticated;
create policy "admins read orders" on public.orders for select to authenticated using(public.is_tym_admin());
create policy "admins update orders" on public.orders for update to authenticated using(public.is_tym_admin()) with check(public.is_tym_admin());
-- No public INSERT or SELECT policies: only the create-order Edge Function may create tickets.

create table if not exists public.site_settings (
 key text primary key,
 value jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon,authenticated;
grant insert,update,delete on public.site_settings to authenticated;
create policy "public reads site settings" on public.site_settings for select to anon,authenticated using(true);
create policy "admins insert settings" on public.site_settings for insert to authenticated with check(public.is_tym_admin());
create policy "admins update settings" on public.site_settings for update to authenticated using(public.is_tym_admin()) with check(public.is_tym_admin());
create policy "admins delete settings" on public.site_settings for delete to authenticated using(public.is_tym_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "public reads product images" on storage.objects for select using(bucket_id='product-images');
create policy "admins upload product images" on storage.objects for insert to authenticated with check(bucket_id='product-images' and public.is_tym_admin());
create policy "admins update product images" on storage.objects for update to authenticated using(bucket_id='product-images' and public.is_tym_admin()) with check(bucket_id='product-images' and public.is_tym_admin());
create policy "admins delete product images" on storage.objects for delete to authenticated using(bucket_id='product-images' and public.is_tym_admin());
