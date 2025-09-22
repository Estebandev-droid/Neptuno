import { supabase } from './supabaseClient'
import type { Role } from '../types/roles'

// Fallback estático para roles del sistema cuando el RPC no está disponible o falla
const FALLBACK_ROLES: Role[] = [
  { id: 'role_owner', name: 'owner', description: 'Propietario del tenant', is_system: true, created_at: new Date().toISOString() },
  { id: 'role_admin', name: 'admin', description: 'Administrador del tenant', is_system: true, created_at: new Date().toISOString() },
  { id: 'role_teacher', name: 'teacher', description: 'Docente/Instructor', is_system: true, created_at: new Date().toISOString() },
  { id: 'role_student', name: 'student', description: 'Estudiante', is_system: true, created_at: new Date().toISOString() },
  { id: 'role_parent', name: 'parent', description: 'Padre/Acudiente', is_system: true, created_at: new Date().toISOString() },
  { id: 'role_viewer', name: 'viewer', description: 'Solo lectura', is_system: true, created_at: new Date().toISOString() },
]

// Listar roles disponibles usando la función RPC, con fallback seguro
export async function listRoles(): Promise<Role[]> {
  try {
    console.log('Consultando roles disponibles...')
    const { data, error } = await supabase.rpc('list_available_roles')

    if (error) {
      console.warn('[rolesService] RPC list_available_roles falló, usando fallback local:', error)
      return FALLBACK_ROLES
    }

    // Convertir el formato de la función RPC al formato esperado por el frontend
    const roles = (data || []).map((role: { role_name: string; description?: string | null }, index: number) => ({
      id: `role_${index}`,
      name: role.role_name,
      description: role.description ?? undefined,
      is_system: true,
      created_at: new Date().toISOString(),
    }))

    // Si la RPC no devolvió nada, usar fallback para asegurar UI funcional
    if (!roles || roles.length === 0) {
      return FALLBACK_ROLES
    }

    console.log('Roles encontrados:', roles.length, roles)
    return roles as Role[]
  } catch (err) {
    console.warn('[rolesService] Error inesperado listando roles, usando fallback local:', err)
    return FALLBACK_ROLES
  }
}

export async function createRole(): Promise<string> {
  // Los roles están predefinidos en el sistema, no se pueden crear nuevos
  console.warn('Intento de crear rol personalizado. Los roles están predefinidos en el sistema.')
  throw new Error('Los roles están predefinidos en el sistema. Use: owner, admin, teacher, student, parent, viewer')
}

export async function renameRole(): Promise<void> {
  // Los roles están predefinidos en el sistema, no se pueden renombrar
  console.warn('Intento de renombrar rol. Los roles están predefinidos en el sistema.')
  throw new Error('Los roles están predefinidos en el sistema y no se pueden renombrar')
}

export async function deleteRole(): Promise<void> {
  // Los roles están predefinidos en el sistema, no se pueden eliminar
  console.warn('Intento de eliminar rol. Los roles están predefinidos en el sistema.')
  throw new Error('Los roles están predefinidos en el sistema y no se pueden eliminar')
}

// Los roles están predefinidos, no se pueden modificar sus descripciones
export async function updateRoleDescription(): Promise<void> {
  console.warn('Intento de actualizar descripción de rol. Los roles están predefinidos en el sistema.')
  throw new Error('Los roles están predefinidos en el sistema y no se pueden modificar')
}