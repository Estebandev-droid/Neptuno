# Backlog inicial — SaaS de Inventarios (MVP)

Versión: 0.1 — Fecha: 2025-09-04

Etiquetas de prioridad: [MVP], [HIGH], [MED], [LOW]

## User stories (MVP)

1) [MVP][HIGH] Como Owner quiero crear mi empresa (tenant) y gestionar invitaciones de usuarios con roles para operar de forma segura.
- Criterios de aceptación:
  - Puedo crear tenant y asignarme rol Owner.
  - Puedo invitar usuarios por email y asignar roles (Admin, Inventario, Ventas, Auditor).
  - RLS garantiza que solo vean datos del tenant.

2) [MVP][HIGH] Como Gestor de Inventario quiero registrar productos/variantes con categorías, impuestos y medios para catalogarlos correctamente.
- Criterios:
  - CRUD de productos y variantes con SKU y códigos de barras.
  - Atributos por categoría; impuestos configurables por empresa.
  - Carga de imágenes a Storage con vínculos a producto.

3) [MVP][HIGH] Como Gestor de Inventario quiero gestionar bodegas y stock por bodega para controlar existencias.
- Criterios:
  - CRUD de bodegas.
  - Vista de stock por producto y bodega.
  - Traspasos entre bodegas generan movimientos.

4) [MVP][HIGH] Como Gestor de Inventario quiero registrar entradas/salidas con lotes/series y costo para mantener kardex PEPS.
- Criterios:
  - Movimientos con tipos: ENTRADA, SALIDA, TRASPASO.
  - Costeo PEPS y sugerencia de picking por lote/fecha.
  - Audit log en cada movimiento.

5) [MVP][HIGH] Como Compras quiero crear pedidos de compra a proveedores para reabastecer.
- Criterios:
  - CRUD de pedidos (estados: CREADO→CONFIRMADO→COMPLETADO/CANCELADO).
  - Ítems ligan a variantes y cantidades/lotes.
  - Confirmación genera ENTRADAS.

6) [MVP][HIGH] Como Ventas B2B quiero crear pedidos de venta a clientes registrados para despachar productos.
- Criterios:
  - CRUD de pedidos de venta (estados: CREADO→CONFIRMADO→ENVIADO→COMPLETADO/CANCELADO).
  - Confirmación y envío generan SALIDAS con PEPS.
  - Estado de pago informativo (no integra pasarela).

7) [MVP][HIGH] Como Admin quiero activar el catálogo público y decidir si muestro precios para atraer clientes.
- Criterios:
  - Toggle por empresa para habilitar catálogo público.
  - Endpoint/página pública lista para SEO.
  - Lista de precios seleccionable para público.

8) [MVP][HIGH] Como Auditor quiero consultar el audit log filtrando por usuario, tabla y fecha para asegurar trazabilidad.
- Criterios:
  - Vista/endpoint con filtros.
  - Registro who/what/when y diff básico.

9) [MVP][MED] Como Admin quiero exportar datos de mi empresa y solicitar borrado de PII conforme a ley.
- Criterios:
  - Export por tenant (CSV/JSON) para entidades clave.
  - Proceso de borrado/anonimización para usuarios y medios.

10) [MVP][MED] Como Admin quiero configurar impuestos y moneda base para facturar correctamente.
- Criterios:
  - CRUD de tasas de impuestos.
  - Moneda base y símbolos.

11) [MVP][MED] Como Admin quiero configurar módulos/plan de mi empresa para habilitar funcionalidades.
- Criterios:
  - Plan Free/Pro/Enterprise y módulos activables.
  - Enforcements por RLS/guards.

12) [MVP][MED] Como Usuario quiero usar la app en español o inglés para facilitar adopción.
- Criterios:
  - i18n es/en; persistencia de preferencia.

## Historias futuras (no-MVP)
- [LOW] Apps nativas iOS/Android (scanner avanzado, notificaciones push).
- [MED] Integración ERP/contabilidad y facturación electrónica.
- [MED] Pasarelas de pago y reco de pago.
- [MED] SSO SAML/OIDC para Enterprise.
- [MED] Reportes avanzados y tablero de quiebres.
- [LOW] Offline avanzado y cola de sincronización.

## Tareas técnicas iniciales
- [MVP] Definir esquema SQL y RLS en Supabase.  
- [MVP] Buckets de Storage por tenant y políticas.  
- [MVP] Funciones/Triggers de PEPS y audit log.  
- [MVP] Scripts de limpieza/export/erase.