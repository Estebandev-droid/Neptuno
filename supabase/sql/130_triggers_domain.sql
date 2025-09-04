-- Neptuno — Supabase SQL — 130 Attach audit trigger to domain tables
set search_path = app, public;

-- Adjuntar trigger de auditoría a todas las tablas de dominio
create trigger categories_audit after insert or update or delete on app.categories for each row execute function app.tg_audit();
create trigger products_audit after insert or update or delete on app.products for each row execute function app.tg_audit();
create trigger variants_audit after insert or update or delete on app.product_variants for each row execute function app.tg_audit();
create trigger media_audit after insert or update or delete on app.product_media for each row execute function app.tg_audit();
create trigger price_lists_audit after insert or update or delete on app.price_lists for each row execute function app.tg_audit();
create trigger price_list_items_audit after insert or update or delete on app.price_list_items for each row execute function app.tg_audit();
create trigger warehouses_audit after insert or update or delete on app.warehouses for each row execute function app.tg_audit();
create trigger batches_audit after insert or update or delete on app.batches for each row execute function app.tg_audit();
create trigger stock_items_audit after insert or update or delete on app.stock_items for each row execute function app.tg_audit();
create trigger invmov_audit after insert or update or delete on app.inventory_movements for each row execute function app.tg_audit();
create trigger invmov_items_audit after insert or update or delete on app.inventory_movement_items for each row execute function app.tg_audit();
create trigger suppliers_audit after insert or update or delete on app.suppliers for each row execute function app.tg_audit();
create trigger customers_audit after insert or update or delete on app.customers for each row execute function app.tg_audit();
create trigger po_audit after insert or update or delete on app.purchase_orders for each row execute function app.tg_audit();
create trigger poi_audit after insert or update or delete on app.purchase_order_items for each row execute function app.tg_audit();
create trigger so_audit after insert or update or delete on app.sales_orders for each row execute function app.tg_audit();
create trigger soi_audit after insert or update or delete on app.sales_order_items for each row execute function app.tg_audit();