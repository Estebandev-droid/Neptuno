import { supabase } from './supabaseClient'
import type { Profile } from '../types/users'

export async function listProfiles(): Promise<Profile[]> {
  // Los admins pueden ver todos, estudiantes solo su perfil (políticas RLS lo limitan)
  console.log('Consultando perfiles...')
  
  // Verificar usuario actual
  const { data: { user } } = await supabase.auth.getUser()
  console.log('Usuario actual:', user?.email, 'ID:', user?.id)
  
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error al consultar perfiles:', error)
    throw error
  }
  
  console.log('Perfiles encontrados:', data?.length || 0, data)
  return data as Profile[]
}

export async function createUser(
  email: string, 
  password: string, 
  fullName?: string, 
  roleName: string = 'student',
  phone?: string,
  signatureUrl?: string,
  photoUrl?: string
) {
  try {
    const cleanEmail = email.trim().toLowerCase()
    
    // Validaciones básicas
    if (!cleanEmail || !password) {
      throw new Error('Email y contraseña son requeridos')
    }

    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres')
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Formato de email inválido')
    }

    // Usar la función Edge Function admin-create-user para crear usuarios de forma segura
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Usuario no autenticado')
    }

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: cleanEmail,
        password: password,
        fullName: fullName?.trim() || cleanEmail.split('@')[0],
        roleName: roleName,
        phone: phone,
        signatureUrl: signatureUrl,
        photoUrl: photoUrl
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (error) {
      console.error('Error en createUser Edge Function:', error)
      throw new Error(`Error al crear usuario: ${error.message}`)
    }

    if (!data || !data.success) {
      const errorMessage = data?.error || 'Error desconocido al crear usuario'
      console.error('Error en createUser Edge Function:', errorMessage)
      throw new Error(`Error al crear usuario: ${errorMessage}`)
    }

    console.log('Usuario creado exitosamente:', data)
    return {
      user: data.user,
    }
  } catch (error) {
    console.error('Error en createUser:', error)
    throw error
  }
}

export async function assignRole(userId: string, roleName: string): Promise<void> {
  // Preferimos RPCs definidas en 005_admin_api.sql
  const { error } = await supabase.rpc('user_role_assign', { p_user: userId, p_role_name: roleName })
  if (error) throw error
}

export async function revokeRole(userId: string, roleName: string): Promise<void> {
  const { error } = await supabase.rpc('user_role_revoke', { p_user: userId, p_role_name: roleName })
  if (error) throw error
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('user_roles_list', { p_user: userId })
  if (error) throw error
  // data es arreglo de objetos con role_name según la función
  return (data as { role_name: string }[]).map(r => r.role_name)
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<void> {
  console.log('Actualizando perfil:', userId, updates)
  
  try {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
    
    if (error) {
      console.error('Error al actualizar perfil:', error)
      throw new Error(`Error al actualizar perfil: ${error.message}`)
    }
    
    console.log('Perfil actualizado exitosamente')
  } catch (error) {
    console.error('Error en updateProfile:', error)
    throw error
  }
}

export async function removeProfile(userId: string): Promise<void> {
  console.log('Eliminando usuario:', userId)
  
  try {
    const { data, error } = await supabase.rpc('delete_dev_user', {
      p_user_id: userId
    })
    
    if (error) {
      console.error('Error en delete_dev_user:', error)
      throw new Error(`Error al eliminar usuario: ${error.message}`)
    }
    
    if (!data.success) {
      console.error('Error en delete_dev_user:', data.error)
      throw new Error(`Error al eliminar usuario: ${data.error}`)
    }
    
    console.log('Usuario eliminado exitosamente:', data.message)
  } catch (error) {
    console.error('Error en removeProfile:', error)
    throw error
  }
}