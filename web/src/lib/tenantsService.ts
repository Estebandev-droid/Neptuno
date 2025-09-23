import { supabase } from './supabaseClient'
import type { Tenant, CreateTenantRequest, UpdateTenantRequest, TenantAdmin, AssignAdminRequest } from '../types/tenants'
import type { Profile } from '../types/users'

// Tipos fuertes para eliminar 'any'
type MembershipAdminRow = {
  id: string
  user_id: string
  tenant_id: string
  role: 'owner' | 'admin'
  permissions: Record<string, unknown>
  is_active: boolean
  joined_at: string
}

type ProfileSummary = {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
}

type ExistingMembership = {
  id: string
  role: 'owner' | 'admin' | 'teacher' | 'student' | 'parent' | 'viewer'
  is_active: boolean
}

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
    .from('memberships')
    .select(`
      id,
      user_id,
      tenant_id,
      role,
      permissions,
      is_active,
      joined_at
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('role', ['owner', 'admin'])
    .order('joined_at', { ascending: false })
  
  if (error) {
    console.error('Error al consultar administradores del tenant (memberships):', error)
    throw error
  }
  
  const memberships: MembershipAdminRow[] = (data as MembershipAdminRow[]) || []
  if (memberships.length === 0) return []
  
  // Obtener perfiles de los usuarios para hidratar los datos
  const userIds: string[] = Array.from(new Set(memberships.map(m => m.user_id)))
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles_with_email')
    .select('id, email, full_name, avatar_url')
    .in('id', userIds)
  
  if (profilesError) {
    console.error('Error al obtener perfiles para administradores del tenant:', profilesError)
    throw profilesError
  }
  
  const profilesMap: Map<string, ProfileSummary> = new Map(
    ((profiles as ProfileSummary[]) ?? []).map(p => [p.id, p])
  )
  
  const admins: TenantAdmin[] = memberships.map(m => {
    const p = profilesMap.get(m.user_id)
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      user_id: m.user_id,
      permissions: ['read', 'write', 'manage_users'],
      created_at: m.joined_at,
      user: p
        ? {
            id: p.id,
            email: p.email ?? '',
            full_name: p.full_name ?? '',
            avatar_url: p.avatar_url ?? undefined,
          }
        : undefined,
    }
  })
  
  console.log('Administradores encontrados:', admins.length, admins)
  return admins
}

export async function assignTenantAdmin(assignData: AssignAdminRequest): Promise<void> {
  console.log('Asignando administrador al tenant (memberships):', assignData)
  
  // Buscar si ya existe una membership (activa o inactiva)
  const { data: existing, error: findError } = await supabase
    .from('memberships')
    .select('id, role, is_active')
    .eq('user_id', assignData.user_id)
    .eq('tenant_id', assignData.tenant_id)
    .maybeSingle()
  
  if (findError) {
    console.error('Error buscando membership existente:', findError)
    throw findError
  }
  
  if (existing) {
    const em = existing as ExistingMembership
    const { error: updateError } = await supabase
      .from('memberships')
      .update({ role: 'admin', is_active: true, updated_at: new Date().toISOString() })
      .eq('id', em.id)
    
    if (updateError) {
      console.error('Error al actualizar membership para asignar admin:', updateError)
      throw updateError
    }
  } else {
    const { error: insertError } = await supabase
      .from('memberships')
      .insert({
        user_id: assignData.user_id,
        tenant_id: assignData.tenant_id,
        role: 'admin',
        permissions: {},
        is_active: true,
      })
    
    if (insertError) {
      console.error('Error al crear membership para asignar admin:', insertError)
      throw insertError
    }
  }
  
  console.log('Administrador asignado correctamente (memberships)')
}

export async function removeTenantAdmin(tenantId: string, userId: string): Promise<void> {
  console.log('Removiendo administrador del tenant (memberships):', { tenantId, userId })
  
  // Solo degradar si actualmente es admin; no degradar owners
  const { error } = await supabase
    .from('memberships')
    .update({ role: 'student', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('role', 'admin')
  
  if (error) {
    console.error('Error al remover administrador del tenant:', error)
    throw error
  }
  
  console.log('Administrador removido correctamente (memberships)')
}

export async function getAvailableUsers(): Promise<Profile[]> {
  console.log('Consultando usuarios disponibles para asignar como administradores...')
  
  const { data, error } = await supabase
    .from('profiles_with_email')
    .select('id, email, full_name, avatar_url, role, tenant_id')
    .in('role', ['teacher', 'student'])
    .order('full_name', { ascending: true })
  
  if (error) {
    console.error('Error al consultar usuarios disponibles:', error)
    throw error
  }
  
  console.log('Usuarios disponibles:', data?.length || 0)
  return (data as Profile[]) || []
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