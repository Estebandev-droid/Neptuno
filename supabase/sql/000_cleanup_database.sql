-- Neptuno — Supabase SQL — 000 Cleanup Database
-- Script para limpiar completamente la base de datos
-- ⚠️  ADVERTENCIA: Este script eliminará TODOS los datos y estructuras
-- Ejecutar solo en desarrollo o cuando se quiera resetear completamente

-- Eliminar todas las tablas del dominio de inventario
DROP TABLE IF EXISTS app.inventory_movements CASCADE;
DROP TABLE IF EXISTS app.inventory_items CASCADE;
DROP TABLE IF EXISTS app.categories CASCADE;
DROP TABLE IF EXISTS app.suppliers CASCADE;
DROP TABLE IF EXISTS app.warehouses CASCADE;

-- Eliminar todas las tablas del dominio de órdenes
DROP TABLE IF EXISTS app.order_items CASCADE;
DROP TABLE IF EXISTS app.orders CASCADE;
DROP TABLE IF EXISTS app.customers CASCADE;

-- Eliminar tablas del esquema base
DROP TABLE IF EXISTS app.audit_log CASCADE;
DROP TABLE IF EXISTS app.app_super_admins CASCADE;
DROP TABLE IF EXISTS app.invitations CASCADE;
DROP TABLE IF EXISTS app.memberships CASCADE;
DROP TABLE IF EXISTS app.tenants CASCADE;

-- Eliminar funciones
DROP FUNCTION IF EXISTS app.get_current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS app.is_super_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS app.has_role_in_tenant(uuid, uuid, app.app_role) CASCADE;
DROP FUNCTION IF EXISTS app.audit_trigger_function() CASCADE;

-- Eliminar tipos personalizados
DROP TYPE IF EXISTS app.app_role CASCADE;
DROP TYPE IF EXISTS app.order_status CASCADE;
DROP TYPE IF EXISTS app.movement_type CASCADE;

-- Eliminar esquema completo (esto eliminará todo lo que quede)
DROP SCHEMA IF EXISTS app CASCADE;

-- Eliminar extensiones si no se usan en otros lugares
-- Comentado por seguridad, descomenta solo si estás seguro
-- DROP EXTENSION IF EXISTS pgcrypto;

-- Mensaje de confirmación
SELECT 'Base de datos limpiada completamente. Ahora ejecuta los scripts en orden.' as mensaje;

/*
ORDEN DE EJECUCIÓN DESPUÉS DE LA LIMPIEZA:

1. 001_schema_base.sql       -- Esquema, tablas base, tipos
2. 010_functions.sql         -- Funciones auxiliares
3. 020_rls_policies.sql      -- Políticas RLS generales
4. 021_rls_super_admins.sql  -- Políticas RLS para super admins
5. 030_triggers_audit.sql    -- Triggers de auditoría
6. 040_seed_super_admin.sql  -- Usuario super admin inicial
7. 100_domain_inventory.sql  -- Dominio de inventario
8. 110_domain_warehouses.sql -- Dominio de almacenes
9. 120_domain_orders.sql     -- Dominio de órdenes
10. 121_rls_domain.sql       -- RLS para dominios
11. 130_triggers_domain.sql  -- Triggers para dominios

NOTA: Asegúrate de configurar el email en 040_seed_super_admin.sql
antes de ejecutarlo.
*/