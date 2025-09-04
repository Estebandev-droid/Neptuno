# Sprint 1 — Plan (Neptuno MVP)

Versión/Workspace: no-vcs-local  
Fechas: 2025-09-04 → 2025-09-11 (1 semana)

Objetivo del sprint
- Base multi-tenant en Supabase (esquema, RLS, funciones y auditoría) + incluir modelos de dominio mínimos de Inventario, Bodegas/Stock y Órdenes (compras/ventas) listos para consumir por el backend/app.

Historias seleccionadas (del backlog inicial)
1) [MVP][HIGH] Multi-tenant seguro (Tenant + invitaciones + roles + Super Admin).  
2) [MVP][HIGH] Catálogo de productos/variantes y categorías.  
3) [MVP][HIGH] Bodegas y stock.  
4) [MVP][HIGH] Pedidos de compra y venta (estructura de datos).  

Alcance/tareas del sprint
- DB — Esquema base: tenants, memberships, invitations, app_super_admins, audit_log.  
- Seguridad — RLS y políticas por tenant (incluye tablas de dominio).  
- Funciones — api_create_tenant, helpers de autorización (is_super_admin, user_has_role).  
- Auditoría — Trigger genérico tg_audit y adjuntar a todas las tablas de dominio.  
- Dominio — Tablas de Inventario (categorías, productos, variantes, media, listas de precios), Bodegas/Stock (warehouses, batches, stock_items, inventory_movements), Órdenes (suppliers, customers, purchase_orders/items, sales_orders/items).  
- Seeds — Script para registrar PO como Super Admin por UID/email.  
- QA — Pruebas manuales: RLS y auditoría sobre tablas base y de dominio.

Definition of Done (DoD)
- Todos los scripts ejecutan sin errores en Supabase.  
- RLS activo y probado en todas las tablas incluidas; Super Admin con bypass.  
- Auditoría registrando mutaciones en tablas base y de dominio.  
- Documentación USAGE.txt actualizada con orden de ejecución y pruebas rápidas.  
- PO validó acceso como Super Admin con su UID de pruebas.

Estimaciones (talla)
- Esquema base + funciones: M  
- Dominio (modelado e índices): L  
- RLS + auditoría aplicada al dominio: M-L  
- Seeds y QA: S

Riesgos
- Ampliación de alcance dentro del sprint incrementa esfuerzo (riesgo de sobrecarga).  
- RLS en múltiples tablas puede requerir ajustes finos durante QA.  
- auth.uid() null en SQL Editor para pruebas de funciones SECURITY DEFINER.  

Bloqueadores/pendientes
- Confirmar ejecución del seed por UID del PO y verificación de app.is_super_admin().  
- Capacidad del equipo (horas efectivas) para asegurar cierre en 1 semana.

Responsables
- Implementación: Dev Agent  
- Aprobación funcional: Product Owner (usted)  
- Scrum Master: coordinación y control de cambios

Ceremonias
- Kickoff: 2025-09-04 (hoy).  
- Daily async breve por chat.  
- Review/Retro: 2025-09-11.