-- Neptuno — Supabase SQL — 121 RLS para tablas de dominio
set search_path = app, public;

-- Habilitar RLS
alter table app.categories enable row level security;
alter table app.products enable row level security;
alter table app.product_variants enable row level security;
alter table app.product_media enable row level security;
alter table app.price_lists enable row level security;
alter table app.price_list_items enable row level security;
alter table app.warehouses enable row level security;
alter table app.batches enable row level security;
alter table app.stock_items enable row level security;
alter table app.inventory_movements enable row level security;
alter table app.inventory_movement_items enable row level security;
alter table app.suppliers enable row level security;
alter table app.customers enable row level security;
alter table app.purchase_orders enable row level security;
alter table app.purchase_order_items enable row level security;
alter table app.sales_orders enable row level security;
alter table app.sales_order_items enable row level security;

-- Helper arrays
-- roles de modificación para inventario
create or replace view app.v_roles_inventory as
  select array['Owner','Admin','Inventario']::app.app_role[] as roles;
-- roles de modificación para ventas
create or replace view app.v_roles_sales as
  select array['Owner','Admin','Ventas']::app.app_role[] as roles;
-- roles administrativos
create or replace view app.v_roles_admin as
  select array['Owner','Admin']::app.app_role[] as roles;

-- Política genérica: SELECT si miembro del tenant o Super Admin
create or replace function app._can_select(tenant uuid)
returns boolean language sql stable as $$
  select app.is_super_admin() or app.user_in_tenant(auth.uid(), tenant)
$$;

-- Categorías
create policy categories_select on app.categories for select using (app._can_select(tenant_id));
create policy categories_modify on app.categories for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)));

-- Productos
create policy products_select on app.products for select using (app._can_select(tenant_id));
create policy products_modify on app.products for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)));

-- Variantes
create policy variants_select on app.product_variants for select using (app._can_select(tenant_id));
create policy variants_modify on app.product_variants for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)));

-- Medios
create policy media_select on app.product_media for select using (app._can_select(tenant_id));
create policy media_modify on app.product_media for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)));

-- Listas de precios
create policy pl_select on app.price_lists for select using (app._can_select(tenant_id));
create policy pl_modify on app.price_lists for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_admin)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_admin)));

create policy pli_select on app.price_list_items for select using (app._can_select(tenant_id));
create policy pli_modify on app.price_list_items for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_admin)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_admin)));

-- Bodegas
create policy wh_select on app.warehouses for select using (app._can_select(tenant_id));
create policy wh_modify on app.warehouses for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_admin)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_admin)));

-- Batches
create policy batches_select on app.batches for select using (app._can_select(tenant_id));
create policy batches_modify on app.batches for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)));

-- Stock
create policy stock_select on app.stock_items for select using (app._can_select(tenant_id));
create policy stock_modify on app.stock_items for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)));

-- Movimientos
create policy invmov_select on app.inventory_movements for select using (app._can_select(tenant_id));
create policy invmov_modify on app.inventory_movements for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)));

create policy invmov_items_select on app.inventory_movement_items for select using (app._can_select(tenant_id));
create policy invmov_items_modify on app.inventory_movement_items for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_inventory)));

-- Suppliers / Customers
create policy sup_select on app.suppliers for select using (app._can_select(tenant_id));
create policy sup_modify on app.suppliers for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_admin)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_admin)));

create policy cust_select on app.customers for select using (app._can_select(tenant_id));
create policy cust_modify on app.customers for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_sales)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_sales)));

-- Purchase Orders
create policy po_select on app.purchase_orders for select using (app._can_select(tenant_id));
create policy po_modify on app.purchase_orders for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_admin)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_admin)));

create policy poi_select on app.purchase_order_items for select using (app._can_select(tenant_id));
create policy poi_modify on app.purchase_order_items for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_admin)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_admin)));

-- Sales Orders
create policy so_select on app.sales_orders for select using (app._can_select(tenant_id));
create policy so_modify on app.sales_orders for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_sales)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_sales)));

create policy soi_select on app.sales_order_items for select using (app._can_select(tenant_id));
create policy soi_modify on app.sales_order_items for all
  using (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_sales)))
  with check (app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, (select roles from app.v_roles_sales)));