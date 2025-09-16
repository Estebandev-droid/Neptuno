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