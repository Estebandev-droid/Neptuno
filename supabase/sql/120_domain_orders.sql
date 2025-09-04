-- Neptuno — Supabase SQL — 120 Domain: Orders (compras y ventas)
set search_path = app, public;

-- Terceros
create table if not exists app.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  name text not null,
  tax_id text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists suppliers_tenant_idx on app.suppliers(tenant_id);

create table if not exists app.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists customers_tenant_idx on app.customers(tenant_id);

-- Compras
create type app.purchase_status as enum ('CREADO','CONFIRMADO','COMPLETADO','CANCELADO');

create table if not exists app.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  supplier_id uuid not null references app.suppliers(id) on delete restrict,
  status app.purchase_status not null default 'CREADO',
  order_date date not null default current_date,
  ref text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists po_tenant_idx on app.purchase_orders(tenant_id);

create table if not exists app.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  purchase_order_id uuid not null references app.purchase_orders(id) on delete cascade,
  variant_id uuid not null references app.product_variants(id) on delete restrict,
  qty numeric(18,6) not null,
  unit_cost numeric(18,6),
  created_at timestamptz not null default now()
);
create index if not exists poi_tenant_idx on app.purchase_order_items(tenant_id);

-- Ventas B2B
create type app.sales_status as enum ('CREADO','CONFIRMADO','ENVIADO','COMPLETADO','CANCELADO');

create table if not exists app.sales_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  customer_id uuid not null references app.customers(id) on delete restrict,
  status app.sales_status not null default 'CREADO',
  order_date date not null default current_date,
  ref text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists so_tenant_idx on app.sales_orders(tenant_id);

create table if not exists app.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  sales_order_id uuid not null references app.sales_orders(id) on delete cascade,
  variant_id uuid not null references app.product_variants(id) on delete restrict,
  qty numeric(18,6) not null,
  unit_price numeric(18,6),
  created_at timestamptz not null default now()
);
create index if not exists soi_tenant_idx on app.sales_order_items(tenant_id);
-- Todas las RLS policies para órdenes se definen en 121_rls_domain.sql