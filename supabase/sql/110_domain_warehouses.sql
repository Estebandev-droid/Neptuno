-- Neptuno — Supabase SQL — 110 Domain: Warehouses & Stock
set search_path = app, public;

-- Bodegas
create table if not exists app.warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  name text not null,
  code text,
  address text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  unique(tenant_id, code)
);
create index if not exists warehouses_tenant_idx on app.warehouses(tenant_id);

-- Lotes/series
create table if not exists app.batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  variant_id uuid not null references app.product_variants(id) on delete cascade,
  batch_code text,
  serial_code text,
  expiry_date date,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists batches_tenant_idx on app.batches(tenant_id);
create index if not exists batches_variant_idx on app.batches(variant_id);

-- Stock por bodega y variante (y lote/serie opcional)
create table if not exists app.stock_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  warehouse_id uuid not null references app.warehouses(id) on delete cascade,
  variant_id uuid not null references app.product_variants(id) on delete cascade,
  batch_id uuid references app.batches(id) on delete set null,
  qty numeric(18,6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
-- Enforce uniqueness using partial unique indexes (batch nullable)
create unique index if not exists stock_items_uq_null_batch on app.stock_items(tenant_id, warehouse_id, variant_id) where batch_id is null;
create unique index if not exists stock_items_uq_batch on app.stock_items(tenant_id, warehouse_id, variant_id, batch_id) where batch_id is not null;
create index if not exists stock_tenant_idx on app.stock_items(tenant_id);
create index if not exists stock_wh_idx on app.stock_items(warehouse_id);
create index if not exists stock_variant_idx on app.stock_items(variant_id);

-- Movimientos de inventario (ledger)
create type app.movement_type as enum ('ENTRADA','SALIDA','TRASPASO');

create table if not exists app.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  type app.movement_type not null,
  warehouse_id uuid not null references app.warehouses(id) on delete restrict,
  to_warehouse_id uuid references app.warehouses(id) on delete restrict,
  ref text,
  movement_date timestamptz not null default now(),
  user_id uuid,
  cost_total numeric(18,6) default 0,
  created_at timestamptz not null default now()
);
create index if not exists invmov_tenant_date_idx on app.inventory_movements(tenant_id, movement_date);

create table if not exists app.inventory_movement_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  movement_id uuid not null references app.inventory_movements(id) on delete cascade,
  variant_id uuid not null references app.product_variants(id) on delete restrict,
  batch_id uuid references app.batches(id) on delete set null,
  qty numeric(18,6) not null,
  unit_cost numeric(18,6),
  cost numeric(18,6)
);
create index if not exists invmov_items_tenant_idx on app.inventory_movement_items(tenant_id);