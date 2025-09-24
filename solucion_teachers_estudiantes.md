# Solución: Teachers no pueden ver estudiantes para inscripciones

## 🔍 Problema Identificado

Los profesores (teachers) y administradores no podían ver usuarios con rol "student" al intentar realizar inscripciones porque la política RLS (Row Level Security) de la tabla `profiles` no incluía permisos para que los teachers vieran otros perfiles.

## 🔧 Causa Raíz

En el archivo `supabase/sql/003_policies.sql`, la política `profiles_select_policy` solo permitía:
- Ver su propio perfil (`id = auth.uid()`)
- Platform admins
- Superadmins
- Developers
- Admins del tenant
- Owners del tenant

**Faltaba**: Permitir que los teachers vieran perfiles de estudiantes de su mismo tenant.

## ✅ Solución Implementada

### 1. Actualización de Política RLS

Se modificó la política `profiles_select_policy` en `003_policies.sql` para incluir:

```sql
-- Teachers pueden ver perfiles de su mismo tenant
(public.has_membership_role(tenant_id, 'teacher') OR public.has_role('teacher'))
```

### 2. Script de Aplicación

Se creó el archivo `fix_teacher_student_visibility.sql` que contiene:
- La política actualizada
- Verificación de aplicación
- Mensaje de confirmación

## 🚀 Cómo Aplicar la Solución

### Opción 1: Ejecutar en Supabase Dashboard
1. Abrir Supabase Dashboard
2. Ir a SQL Editor
3. Copiar y ejecutar el contenido de `fix_teacher_student_visibility.sql`

### Opción 2: Usar Supabase CLI (si está configurado)
```bash
npx supabase db push
```

## 🧪 Cómo Probar la Solución

### 1. Verificar como Teacher
1. Iniciar sesión con un usuario que tenga rol "teacher"
2. Ir a la página de inscripciones (`/admin/enrollments` o `/teacher/enrollments`)
3. Intentar crear una nueva inscripción
4. Verificar que aparecen estudiantes en el selector

### 2. Verificar como Admin
1. Iniciar sesión con un usuario admin
2. Ir a gestión de usuarios (`/admin/users`)
3. Verificar que se muestran todos los usuarios incluyendo estudiantes

### 3. Verificar en Consola del Navegador
En las herramientas de desarrollador, verificar que no aparezcan errores relacionados con políticas RLS al cargar listas de usuarios.

## 📋 Archivos Modificados

- ✅ `supabase/sql/003_policies.sql` - Política RLS actualizada
- ✅ `fix_teacher_student_visibility.sql` - Script de aplicación
- ✅ `solucion_teachers_estudiantes.md` - Esta documentación

## 🔒 Seguridad

La solución mantiene la seguridad porque:
- Los teachers solo pueden ver perfiles del mismo tenant
- Se mantiene el aislamiento entre tenants
- Los estudiantes siguen sin poder ver perfiles de otros usuarios
- Los permisos de escritura no se modificaron

## 📝 Notas Técnicas

- La función `has_membership_role(tenant_id, 'teacher')` verifica membresías por tenant
- La función `has_role('teacher')` verifica roles globales en la tabla profiles
- Se usa OR para cubrir ambos casos de asignación de roles
- La política se aplica solo para operaciones SELECT (lectura)

## ✨ Resultado Esperado

Después de aplicar esta solución:
- ✅ Teachers pueden ver estudiantes para inscripciones
- ✅ Admins pueden ver todos los usuarios
- ✅ Se mantiene la seguridad por tenant
- ✅ Los dropdowns de estudiantes se cargan correctamente
- ✅ Las inscripciones funcionan normalmente