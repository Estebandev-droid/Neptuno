import { supabase } from './supabaseClient'

export interface Membership {
  id: string
  user_id: string
  tenant_id: string
  role: 'owner' | 'admin' | 'teacher' | 'student' | 'parent' | 'viewer'
  permissions: Record<string, unknown>
  is_active: boolean
  joined_at: string
  updated_at: string
  tenant?: {
    id: string
    name: string
    domain?: string
  }
  user?: {
    id: string
    email?: string | null
    full_name?: string | null
    avatar_url?: string | null
  }
}

export interface CreateMembershipRequest {
  user_id: string
  tenant_id: string
  role: 'owner' | 'admin' | 'teacher' | 'student' | 'parent' | 'viewer'
  permissions?: Record<string, unknown>
}

// Obtener memberships de un usuario
export async function getUserMemberships(userId?: string): Promise<Membership[]> {
  const { data: { user } } = await supabase.auth.getUser()
  const targetUserId = userId || user?.id
  
  if (!targetUserId) {
    throw new Error('Usuario no autenticado')
  }

  const { data, error } = await supabase
    .from('memberships')
    .select(`
      *,
      tenant:tenants(
        id,
        name,
        domain
      )
    `)
    .eq('user_id', targetUserId)
    .eq('is_active', true)
    .order('joined_at', { ascending: false })

  if (error) {
    console.error('Error al obtener memberships:', error)
    throw error
  }

  return data || []
}

// Crear membership
export async function createMembership(membership: CreateMembershipRequest): Promise<Membership> {
  const { data, error } = await supabase
    .from('memberships')
    .insert({
      user_id: membership.user_id,
      tenant_id: membership.tenant_id,
      role: membership.role,
      permissions: membership.permissions || {}
    })
    .select(`
      *,
      tenant:tenants(
        id,
        name,
        domain
      )
    `)
    .single()

  if (error) {
    console.error('Error al crear membership:', error)
    throw error
  }

  return data
}

// Actualizar membership
export async function updateMembership(
  membershipId: string, 
  updates: Partial<Pick<Membership, 'role' | 'permissions' | 'is_active'>>
): Promise<Membership> {
  const { data, error } = await supabase
    .from('memberships')
    .update(updates)
    .eq('id', membershipId)
    .select(`
      *,
      tenant:tenants(
        id,
        name,
        domain
      )
    `)
    .single()

  if (error) {
    console.error('Error al actualizar membership:', error)
    throw error
  }

  return data
}

// Desactivar membership
export async function deactivateMembership(membershipId: string): Promise<void> {
  const { error } = await supabase
    .from('memberships')
    .update({ is_active: false })
    .eq('id', membershipId)

  if (error) {
    console.error('Error al desactivar membership:', error)
    throw error
  }
}

// Obtener membership específico por usuario y tenant
export async function getMembershipByUserAndTenant(
  userId: string, 
  tenantId: string
): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select(`
      *,
      tenant:tenants(
        id,
        name,
        domain
      )
    `)
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // No encontrado
    }
    console.error('Error al obtener membership:', error)
    throw error
  }

  return data
}

// Listar memberships por tenant (incluye datos del usuario y del tenant)
export async function listTenantMemberships(tenantId: string): Promise<Membership[]> {
  // 1) Traer memberships + tenant embebido (FK existe)
  const { data, error } = await supabase
    .from('memberships')
    .select(`
      *,
      tenant:tenants(
        id,
        name,
        domain
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('joined_at', { ascending: false })

  if (error) {
    console.error('Error al listar memberships del tenant:', error)
    throw error
  }

  const memberships = (data as Membership[]) || []
  if (memberships.length === 0) return []

  // 2) Como no existe una FK directa memberships.user_id -> profiles.id en el esquema,
  //    obtenemos los perfiles en una consulta separada y los combinamos manualmente.
  const userIds = Array.from(new Set(memberships.map(m => m.user_id)))
  
  // Obtener perfiles (sin email, que está en auth.users)
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds)

  if (profilesError) {
    console.error('Error al obtener perfiles para memberships:', profilesError)
    throw profilesError
  }

  // Obtener emails desde auth.users usando la función admin
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
  
  if (authError) {
    console.error('Error al obtener usuarios de auth para emails:', authError)
    // No lanzamos error aquí, solo continuamos sin emails
  }

  const emailsMap = new Map(
    (authUsers?.users ?? [])
      .filter(user => userIds.includes(user.id))
      .map(user => [user.id, user.email])
  )

  const profilesMap = new Map((profiles ?? []).map(p => [p.id, { ...p, email: emailsMap.get(p.id) || null }]))

  // 3) Devolver memberships con el objeto user hidratado
  return memberships.map(m => ({
    ...m,
    user: profilesMap.get(m.user_id) || undefined,
  }))
}