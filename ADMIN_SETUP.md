# Configuración de Base de Datos - Neptuno

## Scripts de Base de Datos (Orden de Ejecución)

Para configurar la base de datos desde cero, ejecuta los scripts en este orden en el SQL Editor de Supabase:

### 1. Configuración Inicial
```sql
-- 1. Resetear todo (opcional, solo si necesitas limpiar)
\i 000_reset_all.sql

-- 2. Crear esquema y tablas
\i 001_schema.sql

-- 3. Actualizar estructura si es necesario
\i 002_update.sql

-- 4. Insertar datos iniciales
\i 003_seed.sql
```

### 2. Configuración para Desarrollo (SIN PERMISOS)
```sql
-- 5. Deshabilitar RLS para desarrollo libre
\i 010_disable_rls_for_dev.sql

-- 6. Crear funciones RPC sin validaciones de permisos
\i 005_admin_api.sql
```

## Estado Actual

✅ **Funciones RLS deshabilitadas** - Acceso completo a todas las tablas
✅ **Funciones RPC sin validaciones** - Crear/editar/eliminar sin restricciones
✅ **Scripts de permisos eliminados** - Sin complicaciones de administrador

## Funcionalidades Disponibles

- ✅ Crear, editar y eliminar roles
- ✅ Asignar roles a usuarios
- ✅ Gestión completa de perfiles
- ✅ CRUD completo en todas las tablas

## Para Producción (Futuro)

Cuando la aplicación esté lista para producción:

1. Ejecutar `004_policies.sql` para habilitar RLS
2. Modificar `005_admin_api.sql` para agregar validaciones de permisos
3. Crear scripts de asignación de administradores

## Estructura de Archivos

```
supabase/sql/
├── 000_reset_all.sql      # Reset completo (desarrollo)
├── 001_schema.sql         # Estructura de tablas
├── 002_update.sql         # Actualizaciones de esquema
├── 003_seed.sql           # Datos iniciales
├── 004_policies.sql       # Políticas RLS (para producción)
├── 005_admin_api.sql      # Funciones RPC (sin permisos)
└── 010_disable_rls_for_dev.sql  # Deshabilitar RLS
```

## Desarrollo Actual

**Estado**: Desarrollo libre sin restricciones de permisos
**Objetivo**: Construir funcionalidades core de la aplicación
**Seguridad**: Se implementará en fase de producción