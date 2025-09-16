# Scripts SQL de Supabase - Orden de Ejecución

Este directorio contiene los scripts SQL organizados para la base de datos de Supabase del proyecto Neptuno. Los archivos deben ejecutarse en el siguiente orden:

## ⚠️ Script de Limpieza

### `000_cleanup.sql`
**Propósito:** Limpieza completa de la base de datos
- **ADVERTENCIA:** Este script eliminará TODOS los datos y estructuras
- Solo usar en desarrollo o para reset completo
- Elimina todas las tablas, funciones, políticas RLS y buckets de storage
- Incluye verificación final del estado de limpieza

**Uso:**
```bash
# Para limpiar completamente la base de datos
psql -h localhost -p 54322 -U postgres -d postgres -f 000_cleanup.sql
```

## Orden de Ejecución

### 1. `001_schema.sql`
**Propósito:** Definición completa del esquema de base de datos
- Creación de todas las tablas principales
- Definición de columnas, tipos de datos y constraints
- Índices optimizados para rendimiento
- Triggers para campos `updated_at`
- Función `handle_new_user` para creación automática de perfiles

**Tablas incluidas:**
- `tenants` - Organizaciones/inquilinos
- `profiles` - Perfiles de usuarios
- `courses` - Cursos disponibles
- `enrollments` - Inscripciones de estudiantes
- `resources` - Recursos de cursos
- `grades` - Calificaciones
- `evaluations` - Evaluaciones/exámenes
- `evaluation_questions` - Preguntas de evaluaciones
- `student_answers` - Respuestas de estudiantes
- `evaluation_attempts` - Intentos de evaluación
- `certificates` - Certificados emitidos
- `certificate_templates` - Plantillas de certificados
- `notifications` - Sistema de notificaciones
- `roles` - Roles del sistema
- `user_roles` - Asignación de roles a usuarios
- `audit_log` - Registro de auditoría

### 2. `002_functions.sql`
**Propósito:** Funciones RPC y triggers del sistema
- Funciones utilitarias (`set_updated_at`, `sync_platform_admins`)
- Triggers de auditoría para todas las tablas
- Funciones RPC para evaluaciones
- Funciones RPC para notificaciones
- Funciones RPC para certificados
- Funciones RPC para administración y roles

**Funciones principales:**
- `get_evaluation_with_questions` - Obtener evaluación con preguntas
- `start_evaluation_attempt` - Iniciar intento de evaluación
- `auto_grade_evaluation` - Calificación automática
- `create_notification` - Crear notificaciones
- `issue_certificate` - Emitir certificados
- `get_role`, `is_platform_admin`, `has_role` - Helpers de roles

### 3. `003_policies.sql`
**Propósito:** Políticas de seguridad RLS (Row Level Security)
- Políticas de acceso para todas las tablas
- Reglas de seguridad basadas en roles y tenants
- Permisos de lectura, escritura, actualización y eliminación

### 4. `004_storage.sql`
**Propósito:** Configuración de buckets de almacenamiento
- **course-covers:** Imágenes de portada de cursos (público, 5MB)
- **resource-files:** Archivos de recursos (privado, 50MB)
- **tenant-logos:** Logos de organizaciones (público, 2MB)
- Políticas RLS para cada bucket
- Configuración de tipos MIME permitidos

### 5. `005_seed.sql`
**Propósito:** Datos iniciales del sistema
- Roles predeterminados
- Usuarios administradores
- Datos de configuración inicial
- Tenants de ejemplo (opcional)

### 6. `006_disable_rls_dev.sql`
**Propósito:** Configuración para desarrollo
- Deshabilitación temporal de RLS para testing
- **IMPORTANTE:** Solo usar en entorno de desarrollo
- **NO ejecutar en producción**

## Instrucciones de Uso

### Para Entorno de Desarrollo
```bash
# Ejecutar todos los scripts en orden
psql -h localhost -p 54322 -U postgres -d postgres -f 001_schema.sql
psql -h localhost -p 54322 -U postgres -d postgres -f 002_functions.sql
psql -h localhost -p 54322 -U postgres -d postgres -f 003_policies.sql
psql -h localhost -p 54322 -U postgres -d postgres -f 004_storage.sql
psql -h localhost -p 54322 -U postgres -d postgres -f 005_seed.sql
psql -h localhost -p 54322 -U postgres -d postgres -f 006_disable_rls_dev.sql
```

### Para Entorno de Producción
```bash
# NO ejecutar 006_disable_rls_dev.sql en producción
psql -h [host] -p [port] -U [user] -d [database] -f 001_schema.sql
psql -h [host] -p [port] -U [user] -d [database] -f 002_functions.sql
psql -h [host] -p [port] -U [user] -d [database] -f 003_policies.sql
psql -h [host] -p [port] -U [user] -d [database] -f 004_storage.sql
psql -h [host] -p [port] -U [user] -d [database] -f 005_seed.sql
```

### Usando Supabase CLI
```bash
# Resetear la base de datos y aplicar migraciones
supabase db reset

# O aplicar manualmente
supabase db push
```

### Verificación de limpieza
```bash
# Verificar qué elementos quedaron después de la limpieza
supabase db shell --file check_remaining_tables.sql
```

**Nota:** Si no tienes Supabase CLI instalado, puedes ejecutar los archivos SQL directamente en la interfaz web de Supabase (SQL Editor).

## Notas Importantes

1. **Orden Crítico:** Los archivos DEBEN ejecutarse en el orden especificado debido a las dependencias entre tablas, funciones y políticas.

2. **Entorno de Desarrollo:** El archivo `006_disable_rls_dev.sql` facilita el desarrollo al deshabilitar RLS, pero NUNCA debe usarse en producción.

3. **Seguridad:** Las políticas RLS en `003_policies.sql` son críticas para la seguridad del sistema multi-tenant.

4. **Storage:** Los buckets de `004_storage.sql` deben configurarse antes de subir archivos desde la aplicación.

5. **Funciones RPC:** Las funciones en `002_functions.sql` son llamadas directamente desde la aplicación frontend.

## Estructura de Archivos Anterior (Eliminada)

Los siguientes archivos fueron consolidados y eliminados:
- `005_admin_api.sql` → Consolidado en `002_functions.sql`
- `006_storage.sql` → Consolidado en `004_storage.sql`
- `007_resource_storage.sql` → Consolidado en `004_storage.sql`
- `008_tenant_logos_storage.sql` → Consolidado en `004_storage.sql`
- `011_notifications_certificates_rpc.sql` → Consolidado en `002_functions.sql`
- `012_certificate_templates.sql` → Consolidado en `001_schema.sql`
- `013_evaluations_system.sql` → Consolidado en `001_schema.sql`

Esta reorganización mejora la mantenibilidad y reduce la complejidad del sistema de migraciones.