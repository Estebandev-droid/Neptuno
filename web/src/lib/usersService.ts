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

    // Verificar usuario actual
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      throw new Error('Usuario no autenticado')
    }

    // Verificar permisos del usuario actual
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single()

    if (!currentProfile || !['admin', 'super_admin', 'platform_admin', 'tenant_admin'].includes(currentProfile.role)) {
      throw new Error('No tienes permisos para crear usuarios')
    }

    // Crear usuario usando la API estándar de Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          full_name: fullName?.trim() || cleanEmail.split('@')[0],
          role: roleName,
          phone: phone,
          signature_url: signatureUrl,
          photo_url: photoUrl,
        }
      }
    })

    if (authError) {
      console.error('Error al crear usuario:', authError)
      throw new Error(`Error al crear usuario: ${authError.message}`)
    }

    if (!authData.user) {
      throw new Error('Error al crear usuario')
    }

    // El trigger handle_new_user() creará automáticamente el perfil
    // Esperar un momento para que se ejecute el trigger
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Actualizar información adicional si es necesario
    if (signatureUrl || photoUrl || (roleName && roleName !== 'student')) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          signature_url: signatureUrl,
          avatar_url: photoUrl,
          role: roleName,
        })
        .eq('id', authData.user.id)

      if (updateError) {
        console.warn('Error actualizando perfil:', updateError)
        // No lanzar error aquí ya que el usuario fue creado exitosamente
      }
    }

    console.log('Usuario creado exitosamente:', authData.user)
    return {
      user: authData.user,
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