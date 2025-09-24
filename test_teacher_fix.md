# Prueba de Corrección de Roles Teacher

## Problema Identificado
Los hooks `useInstructors()` estaban filtrando por rol 'instructor' en lugar de 'teacher', que es el rol correcto según el sistema.

## Cambios Realizados

### 1. Corregido en `useUsers.ts`
```typescript
// Antes:
profile.role === 'instructor' || profile.role === 'admin'

// Después:
profile.role === 'teacher' || profile.role === 'admin'
```

### 2. Corregido en `useAppData.ts`
```typescript
// Antes:
profile.role === 'instructor' || profile.role === 'admin'

// Después:
profile.role === 'teacher' || profile.role === 'admin'
```

## Pasos para Probar

1. **Crear un usuario con rol teacher:**
   - Ir a `/admin/users`
   - Crear nuevo usuario
   - Asignar rol 'teacher'

2. **Verificar que aparece en selectores:**
   - Ir a `/teacher/courses`
   - Verificar que el usuario teacher aparece en el selector de instructores
   - Crear un curso y asignar el teacher como instructor

3. **Verificar funcionalidades:**
   - El teacher debe poder ver y gestionar cursos
   - Debe aparecer en filtros de instructor
   - Debe tener permisos correctos según las políticas RLS

## Roles del Sistema
- `owner`: Propietario del tenant
- `admin`: Administrador del tenant
- `teacher`: Docente/Instructor ✅ (corregido)
- `student`: Estudiante
- `parent`: Padre/Acudiente
- `viewer`: Solo lectura