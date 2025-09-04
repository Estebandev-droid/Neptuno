-- Neptuno — Supabase SQL — 100 Domain: Inventory (productos, categorías, precios)
set search_path = app, public;

-- Categorías
create table if not exists app.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  parent_id uuid references app.categories(id) on delete set null,
  name text not null,
  attributes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz
);
create index if not exists categories_tenant_idx on app.categories(tenant_id);

-- Productos
create table if not exists app.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  name text not null,
  description text,
  category_id uuid references app.categories(id) on delete set null,
  tax_rate numeric(5,4) default 0.0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz
);
create index if not exists products_tenant_idx on app.products(tenant_id);

-- Variantes
create table if not exists app.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  product_id uuid not null references app.products(id) on delete cascade,
  sku text not null,
  barcode text,
  attributes jsonb not null default '{}'::jsonb,
  unit text default 'unit',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  unique(tenant_id, sku)
);
create index if not exists variants_tenant_idx on app.product_variants(tenant_id);
create index if not exists variants_product_idx on app.product_variants(product_id);

-- Medios (imágenes/videos) vinculados a productos/variantes
create table if not exists app.product_media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  product_id uuid references app.products(id) on delete cascade,
  variant_id uuid references app.product_variants(id) on delete set null,
  kind text not null check (kind in ('image','video','doc')),
  storage_path text not null,
  alt text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists media_tenant_idx on app.product_media(tenant_id);

-- Listas de precios
create table if not exists app.price_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  name text not null,
  currency text not null default 'USD',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  unique(tenant_id, name)
);
create index if not exists price_lists_tenant_idx on app.price_lists(tenant_id);

create table if not exists app.price_list_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  price_list_id uuid not null references app.price_lists(id) on delete cascade,
  variant_id uuid not null references app.product_variants(id) on delete cascade,
  price numeric(18,6) not null,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  created_by uuid,
  unique(tenant_id, price_list_id, variant_id)
);
create index if not exists pli_tenant_idx on app.price_list_items(tenant_id);