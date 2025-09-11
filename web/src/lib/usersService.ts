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
  // Crear usuario usando la función create_dev_user de SQL
  console.log('Creando usuario:', { email, fullName, roleName, phone })
  
  try {
    // Validación de email opcional - solo si se proporciona
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        throw new Error('Por favor ingresa un email válido (ejemplo: usuario@dominio.com)')
      }
      
      // Validar que no sea un email temporal o de prueba
      const tempDomains = ['example.com', 'test.com', 'temp.com']
      const domain = email.split('@')[1]?.toLowerCase()
      if (tempDomains.includes(domain)) {
        throw new Error('No se permiten emails de dominios temporales')
      }
    }
    
    const devPassword = password || 'password123'
    
    // Usar la función RPC create_dev_user con todos los campos
    const { data, error } = await supabase.rpc('create_dev_user', {
      p_email: email,
      p_password: devPassword,
      p_full_name: fullName || (email ? email.split('@')[0] : 'Usuario'),
      p_role_name: roleName,
      p_phone: phone,
      p_signature_url: signatureUrl,
      p_photo_url: photoUrl
    })
    
    if (error) {
      console.error('Error en create_dev_user:', error)
      throw new Error(`Error al crear usuario: ${error.message}`)
    }
    
    if (!data.success) {
      console.error('Error en create_dev_user:', data.error)
      throw new Error(`Error al crear usuario: ${data.error}`)
    }
    
    console.log('Usuario creado exitosamente:', data)
    return {
      user: {
        id: data.user_id,
        email: data.email,
        user_metadata: {
          full_name: data.full_name
        }
      }
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