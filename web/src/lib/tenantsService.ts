import { supabase } from './supabaseClient'
import type { Tenant, CreateTenantRequest, UpdateTenantRequest, TenantAdmin, AssignAdminRequest } from '../types/tenants'
import type { Profile } from '../types/users'

export async function listTenants(): Promise<Tenant[]> {
  console.log('Consultando tenants...')
  
  const { data: { user } } = await supabase.auth.getUser()
  console.log('Usuario actual:', user?.email, 'ID:', user?.id)
  
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error al consultar tenants:', error)
    throw error
  }
  
  console.log('Tenants encontrados:', data?.length || 0, data)
  return data as Tenant[]
}

export async function getTenant(id: string): Promise<Tenant | null> {
  console.log('Consultando tenant:', id)
  
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error al consultar tenant:', error)
    throw error
  }
  
  return data as Tenant
}

export async function createTenant(tenantData: CreateTenantRequest): Promise<Tenant> {
  console.log('Creando tenant:', tenantData)
  
  const { data, error } = await supabase
    .from('tenants')
    .insert({
      name: tenantData.name,
      domain: tenantData.domain,
      branding: tenantData.branding,
      plan: tenantData.plan || 'basic'
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error al crear tenant:', error)
    throw error
  }
  
  console.log('Tenant creado:', data)
  return data as Tenant
}

export async function updateTenant(id: string, tenantData: UpdateTenantRequest): Promise<Tenant> {
  console.log('Actualizando tenant:', id, tenantData)
  
  const updateData: Partial<Tenant> & { updated_at: string } = {
    updated_at: new Date().toISOString()
  }
  
  if (tenantData.name !== undefined) updateData.name = tenantData.name
  if (tenantData.domain !== undefined) updateData.domain = tenantData.domain
  if (tenantData.branding !== undefined) updateData.branding = tenantData.branding
  if (tenantData.plan !== undefined) updateData.plan = tenantData.plan
  
  const { data, error } = await supabase
    .from('tenants')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('Error al actualizar tenant:', error)
    throw error
  }
  
  console.log('Tenant actualizado:', data)
  return data as Tenant
}

export async function deleteTenant(id: string): Promise<void> {
  console.log('Eliminando tenant:', id)
  
  const { error } = await supabase
    .from('tenants')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error al eliminar tenant:', error)
    throw error
  }
  
  console.log('Tenant eliminado:', id)
}

// Gestión de administradores de tenant
export async function listTenantAdmins(tenantId: string): Promise<TenantAdmin[]> {
  console.log('Consultando administradores del tenant:', tenantId)
  
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      tenant_id,
      email,
      full_name,
      avatar_url,
      role,
      created_at
    `)
    .eq('tenant_id', tenantId)
    .eq('role', 'tenant_admin')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error al consultar administradores del tenant:', error)
    throw error
  }
  
  // Transformar los datos al formato esperado
  const admins = data?.map(profile => ({
    id: profile.id,
    tenant_id: profile.tenant_id,
    user_id: profile.id,
    permissions: ['read', 'write', 'manage_users'], // Permisos por defecto
    created_at: profile.created_at,
    user: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url
    }
  })) || []
  
  console.log('Administradores encontrados:', admins.length, admins)
  return admins as TenantAdmin[]
}

export async function assignTenantAdmin(assignData: AssignAdminRequest): Promise<void> {
  console.log('Asignando administrador al tenant:', assignData)
  
  const { error } = await supabase
    .from('profiles')
    .update({
      tenant_id: assignData.tenant_id,
      role: 'tenant_admin',
      updated_at: new Date().toISOString()
    })
    .eq('id', assignData.user_id)
  
  if (error) {
    console.error('Error al asignar administrador al tenant:', error)
    throw error
  }
  
  console.log('Administrador asignado correctamente')
}

export async function removeTenantAdmin(userId: string): Promise<void> {
  console.log('Removiendo administrador del tenant:', userId)
  
  const { error } = await supabase
    .from('profiles')
    .update({
      tenant_id: null,
      role: 'student', // Rol por defecto
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
  
  if (error) {
    console.error('Error al remover administrador del tenant:', error)
    throw error
  }
  
  console.log('Administrador removido correctamente')
}

// Obtener usuarios disponibles para asignar como administradores
export async function getAvailableUsers(): Promise<Profile[]> {
  console.log('Consultando usuarios disponibles para asignar como administradores...')
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, tenant_id')
    .in('role', ['teacher', 'student']) // Solo usuarios que pueden ser promovidos
    .order('full_name', { ascending: true })
  
  if (error) {
    console.error('Error al consultar usuarios disponibles:', error)
    throw error
  }
  
  console.log('Usuarios disponibles:', data?.length || 0)
  return data || []
}

export async function uploadTenantLogo(file: File, tenantId: string): Promise<string> {
  if (!file) throw new Error('Archivo de imagen requerido')
  if (!tenantId) throw new Error('ID de tenant requerido')
  if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen')
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) throw new Error('La imagen excede 5MB')

  const bucket = 'tenant-logos'
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${tenantId}/logo-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  })
  if (uploadError) {
    console.error('Error al subir logo del tenant:', uploadError)
    throw uploadError
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  const publicUrl = data.publicUrl
  if (!publicUrl) throw new Error('No se pudo obtener URL pública del logo')
  return publicUrl
}