# 🌊 Neptuno - Scripts SQL Optimizados para Supabase

## 🚀 Ejecución Rápida

### Opción 1: Script Maestro (Recomendado)
```bash
# Usando psql
psql -h your-host -U postgres -d your-database -f run_all.sql

# Usando Supabase CLI
supabase db reset
```

### Opción 2: Ejecución Manual
```bash
# Orden de ejecución (IMPORTANTE: seguir este orden)
psql -f 001_schema.sql
psql -f 002_functions.sql  
psql -f 003_policies.sql
psql -f 004_storage.sql
psql -f 005_seed.sql
```

### Opción 3: Dashboard de Supabase
1. Ir a SQL Editor en el dashboard
2. Ejecutar cada script en orden secuencial
3. Verificar que no hay errores entre scripts

> ⚠️ **Importante**: Los scripts son **idempotentes** - se pueden ejecutar múltiples veces sin problemas.

## 📋 Estructura de Scripts

| Script | Propósito | Obligatorio | Entorno |
|--------|-----------|-------------|---------|
| `000_cleanup.sql` | 🧹 Limpieza completa de BD | ❌ Opcional | Desarrollo |
| `001_schema.sql` | 📊 Esquema de base de datos | ✅ Requerido | Todos |
| `002_functions.sql` | ⚙️ Funciones y triggers | ✅ Requerido | Todos |
| `003_policies.sql` | 🔒 Políticas RLS y seguridad | ✅ Requerido | Todos |
| `004_storage.sql` | 📁 Configuración de storage | ✅ Requerido | Todos |
| `005_seed.sql` | 🌱 Datos iniciales | ✅ Requerido | Todos |
| `run_all.sql` | 🎯 Script maestro | ✅ Recomendado | Todos |

### 📝 Detalles de Scripts

#### 🧹 000_cleanup.sql
- **Propósito**: Limpieza completa para desarrollo
- **Incluye**: Drop de tablas, funciones, políticas, buckets
- **⚠️ Advertencia**: Elimina TODOS los datos
- **Uso**: Solo para resetear en desarrollo

#### 📊 001_schema.sql  
- **Propósito**: Estructura completa de base de datos
- **Incluye**: 20+ tablas, índices, constraints, extensiones
- **Características**: Multi-tenant, auditoria, timestamps automáticos

#### ⚙️ 002_functions.sql
- **Propósito**: Lógica de negocio y utilidades
- **Incluye**: 
  - Funciones de autenticación y autorización
  - Triggers para timestamps y auditoria
  - Función `create_user_admin` para panel administrativo
  - Funciones de utilidad multi-tenant
- **Ventaja**: Toda la lógica centralizada

#### 🔒 003_policies.sql
- **Propósito**: Seguridad Row Level Security (RLS)
- **Incluye**:
  - Habilitación de RLS en todas las tablas
  - Políticas básicas y avanzadas
  - Políticas específicas para producción
  - Verificación automática de RLS
- **Ventaja**: Seguridad robusta para multi-tenancy

#### 📁 004_storage.sql
- **Propósito**: Configuración de almacenamiento
- **Incluye**: Buckets para covers de cursos y archivos de recursos
- **Políticas**: Acceso controlado por roles

#### 🌱 005_seed.sql
- **Propósito**: Datos iniciales del sistema
- **Incluye**: Roles, tenant por defecto, configuraciones

## 🎯 Características Principales

- ✅ **Multi-tenant**: Soporte completo para múltiples organizaciones
- ✅ **Seguridad RLS**: Row Level Security en todas las tablas
- ✅ **Auditoria**: Tracking automático de cambios
- ✅ **Roles flexibles**: Sistema de roles y permisos granular
- ✅ **Storage integrado**: Manejo de archivos con políticas de seguridad
- ✅ **Funciones RPC**: APIs internas para operaciones complejas
- ✅ **Idempotente**: Scripts ejecutables múltiples veces
- ✅ **Optimizado**: Estructura consolidada y eficiente

## 🏗️ Configuración por Entorno

### 🔧 Desarrollo
```bash
# Resetear BD (opcional)
psql -f 000_cleanup.sql

# Configuración completa
psql -f run_all.sql
```

### 🚀 Producción
```bash
# Solo configuración (sin cleanup)
psql -f run_all.sql

# O usando Supabase CLI
supabase db push
```

## 🔍 Verificación Post-Instalación

### Verificar Tablas
```sql
SELECT count(*) as total_tables 
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Resultado esperado: ~20 tablas
```

### Verificar Funciones
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION';
```

### Verificar Storage
```sql
SELECT bucket_id, public 
FROM storage.buckets;
-- Resultado esperado: course-covers, resource-files
```

### Verificar Roles
```sql
SELECT name, description 
FROM public.roles 
ORDER BY name;
-- Resultado esperado: student, teacher, admin, etc.
```

### Verificar RLS
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = true;
```

## 🚨 Solución de Problemas

### Error: "relation does not exist"
**Causa**: Scripts ejecutados fuera de orden
**Solución**: 
```bash
# Ejecutar en orden correcto
psql -f 001_schema.sql
psql -f 002_functions.sql
# ... continuar secuencialmente
```

### Error: "permission denied for schema public"
**Causa**: Permisos insuficientes
**Solución**: Verificar que el usuario tenga permisos de superusuario o usar el usuario `postgres`

### Error: "bucket already exists"
**Causa**: Storage ya configurado
**Solución**: Normal, el script es idempotente. Continuar con normalidad.

### Error: "function already exists"
**Causa**: Funciones ya creadas
**Solución**: Normal, se usa `CREATE OR REPLACE`. Continuar con normalidad.

## 📊 Estructura de Datos

### Tablas Principales
- `tenants` - Organizaciones/empresas
- `profiles` - Perfiles de usuario
- `courses` - Cursos y contenido
- `enrollments` - Inscripciones
- `evaluations` - Evaluaciones y exámenes
- `certificates` - Certificados generados

### Tablas de Sistema
- `roles` - Roles del sistema
- `user_roles` - Asignación de roles
- `memberships` - Membresías multi-tenant
- `platform_admins` - Administradores de plataforma

## 🔗 Recursos Adicionales

- [Documentación de Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Guía de Storage](https://supabase.com/docs/guides/storage)
- [Funciones de Base de Datos](https://supabase.com/docs/guides/database/functions)

---

**✨ ¡Listo para usar con Supabase!** 

La estructura está optimizada para máximo rendimiento y seguridad en entornos de producción.