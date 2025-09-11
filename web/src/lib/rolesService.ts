import { supabase } from './supabaseClient'
import type { Role } from '../types/roles'

// Listar roles (RLS: solo platform_admin puede ver)
export async function listRoles(): Promise<Role[]> {
  console.log('Consultando roles...')
  const { data, error } = await supabase.from('roles').select('id, name, description, is_system, created_at').order('name')
  if (error) {
    console.error('Error al consultar roles:', error)
    throw error
  }
  console.log('Roles encontrados:', data?.length || 0, data)
  return data as Role[]
}

export async function createRole(name: string, description?: string): Promise<string> {
  // Preferir RPC para validar permisos del lado de Supabase
  console.log('Creando rol:', name, 'con descripción:', description)
  const { data, error } = await supabase.rpc('role_create', { p_name: name, p_description: description ?? null })
  if (error) {
    console.error('Error al crear rol:', error)
    throw error
  }
  console.log('Rol creado/upsert exitosamente:', data)
  return data as string
}

export async function renameRole(oldName: string, newName: string): Promise<void> {
  const { error } = await supabase.rpc('role_rename', { p_old_name: oldName, p_new_name: newName })
  if (error) throw error
}

export async function deleteRole(name: string): Promise<void> {
  const { error } = await supabase.rpc('role_delete', { p_name: name })
  if (error) throw error
}

// Actualiza solo la descripción de un rol existente (usa role_create con mismo nombre)
export async function updateRoleDescription(name: string, description: string | null): Promise<void> {
  const { error } = await supabase.rpc('role_create', { p_name: name, p_description: description })
  if (error) throw error
}