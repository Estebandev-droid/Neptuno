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
  // IMPORTANTE: Esta función NO debe causar auto-login del usuario creado
  // Solo crea el perfil y asigna roles, sin afectar la sesión actual del admin
  console.log('Creando usuario:', { email, fullName, roleName, phone })
  
  try {
    // Limpiar/normalizar email (eliminar caracteres invisibles y espacios alrededor)
    const cleanEmail = email
      ?.replace(/[\u200B-\u200D\uFEFF]/g, '') // quita zero-width chars
      .trim()
      .toLowerCase()

    // Validaciones obligatorias
    if (!cleanEmail) {
      throw new Error('El email es obligatorio para crear usuarios')
    }
    if (/\s/.test(cleanEmail)) {
      throw new Error('El correo no debe contener espacios')
    }
    if (!password || password.length < 6) {
      throw new Error('La contraseña es obligatoria y debe tener al menos 6 caracteres')
    }

    // Validación de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Por favor ingresa un email válido (ejemplo: usuario@dominio.com)')
    }

    // Evitar ciertos dominios temporales comunes (ejemplo)
    const tempDomains = ['example.com', 'test.com', 'temp.com']
    const domain = cleanEmail.split('@')[1]?.toLowerCase()
    if (tempDomains.includes(domain)) {
      throw new Error('No se permiten emails de dominios temporales')
    }

    // SOLUCIÓN AL AUTO-LOGIN:
    // En lugar de usar signUp (que crea sesión), usamos la API de administración
    // Para desarrollo, creamos directamente el perfil y rol sin tocar auth.users
    
    // Verificar si el usuario ya existe
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', cleanEmail)
      .single()

    if (existingProfile) {
      throw new Error('Ya existe un usuario con este email')
    }

    // Crear usuario usando función RPC que no causa auto-login
    const { data, error } = await supabase.rpc('create_user_admin', {
      p_email: cleanEmail,
      p_password: password,
      p_full_name: fullName?.trim() || cleanEmail.split('@')[0],
      p_role_name: roleName,
      p_phone: phone,
      p_signature_url: signatureUrl,
      p_photo_url: photoUrl,
    })

    if (error) {
      console.error('Error en create_user_admin:', error)
      throw new Error(`Error al crear usuario: ${error.message}`)
    }

    if (!data?.success) {
      console.error('Error en create_user_admin:', data?.error)
      throw new Error(`Error al crear usuario: ${data?.error || 'desconocido'}`)
    }

    console.log('Usuario creado exitosamente sin auto-login:', data)
    return {
      user: {
        id: data.user_id,
        email: data.email,
        user_metadata: {
          full_name: data.full_name,
        },
      },
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