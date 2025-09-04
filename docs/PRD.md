# PRD — SaaS de Inventarios Multi‑tenant (Supabase)

Versión: 0.1 (sin VCS en workspace)  
Fecha: 2025-09-04  
Owner: Product Owner (Duván)  
Analyst: Trae AI (BMAD — Analyst)

## 1. Resumen ejecutivo
SaaS B2B multi‑tenant para gestión de inventarios y pedidos (B2B) con control PEPS/FIFO, soporte de lotes/series, multi‑bodega, catálogo público opt‑in y almacenamiento de medios (firmas, imágenes, videos) en Supabase. Web + PWA como plataforma inicial. Seguridad por RLS y auditoría por mutación.

## 2. Objetivos y KPI
- Primario: MRR y ARPU (conversión a plan pago).  
- Secundarios: Retención 30 días, reducción de quiebres de stock, tiempo medio de alta de producto.

## 3. Alcance MVP (12 semanas)
Incluye: auth (email+OAuth Google), multi‑tenant RLS, CRUD de empresas/usuarios/roles, productos y variantes, categorías/atributos, bodegas y stock por bodega, movimientos (entradas/salidas/traspasos), PEPS básico (costeo + sugerencia picking), lotes/series y caducidad opcional por categoría, pedidos de compra y pedidos de venta B2B (estados: CREADO/CONFIRMADO/ENVIADO/COMPLETADO/CANCELADO), catálogo público opt‑in con control de precios visible/oculto, Supabase Storage para medios/firmas, audit log, i18n es/en, multi‑moneda por empresa, configuración de impuestos por empresa. Fuera de MVP: pagos integrados, ERPs, apps nativas, SSO enterprise.

## 4. Usuarios y personas
- Owner (empresa), Admin, Inventario, Ventas/Caja, Auditor (solo lectura), Cliente B2B autenticado (pedidos), Visitante público (catálogo).  
Modelo: un usuario puede pertenecer a múltiples empresas; existe Super‑admin global (Soporte) con controles estrictos.

## 5. Requisitos funcionales
- Multi‑tenant: tenant_id en tablas críticas; membresías usuario↔empresa con rol.  
- Roles y permisos (MVP): Owner, Admin, Inventario, Ventas/Caja, Auditor.  
- Productos: SKU, variantes, atributos, códigos de barras, unidades, impuestos, listas de precios.  
- Medios: imágenes/videos por producto; firmas digitales en recepciones/entregas/auditorías.  
- Bodegas: múltiples por empresa; ubicaciones opcionales; stock por bodega.  
- Movimientos: entradas, salidas, traspasos; ledger inmutable de inventario con costo.  
- PEPS/FIFO: valoración de costo y sugerencia de picking; FEFO por caducidad opcional.  
- Lotes/series: por categoría/tipo de producto; fechas de caducidad.  
- Pedidos: compra a proveedor y venta B2B (clientes); registrar estado y estado de pago (informativo).  
- Catálogo público: opt‑in por empresa; visibilidad de precios configurable; SEO básico.  
- Auditoría: bitácora who/what/when por mutación crítica.  
- Configuración: impuestos, monedas, planes/módulos por empresa.  
- Reportes iniciales: existencias por bodega, kardex por producto, quiebres potenciales.

## 6. Requisitos no funcionales
- Seguridad y privacidad: RLS por tenant; Supabase Auth y Storage; cumplimiento Colombia (Habeas Data) y GDPR si aplica; controles de acceso/borrado de PII/medios.  
- Rendimiento/escala (12m): 500–5,000 empresas; 5k–25k usuarios; 100–2,000 SKUs/empresa; 1k–50k movimientos/día. Índices en inventory_movements(movement_date, warehouse_id, product_id); considerar particionado por fecha si >50k/día.  
- Disponibilidad: PWA; tiempos de recuperación/backup gestionados por Supabase; export de datos por tenant.  
- Accesibilidad: WCAG AA; i18n es/en.  
- Observabilidad: métricas de uso, logs de auditoría y de errores.

## 7. Restricciones
- Stack gestionado en Supabase (Postgres, Auth, Storage).  
- Web + PWA (no apps nativas en MVP).  
- Sin integraciones complejas en MVP; diseño extensible (webhooks + connector table).

## 8. Riesgos
- Complejidad de PEPS/FEFO y lotes; errores afectan costo.  
- Cumplimiento y solicitudes de acceso/borrado (GDPR/Habeas Data).  
- Escala de movimientos; necesidad de particionado.  
- PWA sin offline avanzado (riesgo operativo en campo).  
- Gestión de medios (límites y costos de Storage).

## 9. Dependencias
Supabase (DB/Auth/Storage), CDN estático, lib de i18n, framework web (a definir por Architect), herramientas de gestión (Slack/Notion/GitHub/Jira).

## 10. Modelo de datos (resumen propuesto)
- tenants (empresas), users, memberships (user↔tenant, rol).  
- products, product_variants, categories, product_media, price_lists, price_list_items.  
- warehouses, stock_items (por variant/warehouse/lote), batches (lotes/series, caducidad).  
- inventory_movements (entrada/salida/traspaso + costo, referencia y usuario).  
- purchase_orders, purchase_order_items, sales_orders, sales_order_items, customers, suppliers.  
- public_catalog_settings, public_catalog_products.  
- signatures, documents (Storage refs), audit_log.  
- plans, tenant_plan_modules, webhooks/connectors.  
Cada tabla crítica lleva tenant_id y RLS.

## 11. Seguridad y RLS (principios)
- RLS: acceso solo a filas con tenant_id ∈ membresías del usuario; super‑admin con bypass controlado.  
- Storage: bucket por tenant (tenant_<id>_media) con subcarpetas signatures/, images/, videos/, docs/; políticas de lectura/escritura por rol.  
- Borrado/Export: endpoints y SQL para atender solicitudes legales (export/erase por tenant/usuario).

## 12. Roadmap de MVP (hitos por semana)
- S1–2: base multi‑tenant (auth, tenants, memberships, RLS, i18n).  
- S3–4: productos/variantes/categorías/medios.  
- S5–6: bodegas, stock, movimientos, PEPS básico.  
- S7–8: pedidos compra y venta B2B; clientes/proveedores.  
- S9: catálogo público opt‑in.  
- S10: auditoría y reportes iniciales.  
- S11: hardening, políticas de privacidad/exports.  
- S12: QA, performance y lanzamiento.

## 13. Medición
Tablero con: conversión a pago (trial→pago), ARPU, retención 30d, % quiebres, TTA producto.

## 14. Criterios de aceptación (MVP)
- RLS probado: un usuario no ve datos de otra empresa; super‑admin con trazabilidad.  
- Kardex y costos por PEPS consistentes frente a suite de casos.  
- Pedidos de compra/venta recorren ciclo completo con movimientos asociados.  
- Catálogo público por empresa funciona y respeta visibilidad de precios.  
- Audit log presente en mutaciones críticas; export/erase disponibles por tenant.