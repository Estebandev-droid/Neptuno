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

export async function createUser(email: string, password: string, fullName?: string) {
  // Crear usuario usando signUp con configuración para desarrollo
  console.log('Creando usuario:', { email, fullName })
  
  try {
    // Asegurar formato de email válido
    const devEmail = email.includes('@') ? email : `${email}@example.com`
    const devPassword = password || 'password123'
    
    // Intentar crear usuario con signUp
    const { data, error } = await supabase.auth.signUp({
      email: devEmail,
      password: devPassword,
      options: {
        data: {
          full_name: fullName || email.split('@')[0]
        }
      }
    })
    
    if (error) {
      console.error('Error en signUp:', error)
      
      // Si el error es por email ya existente, intentar obtener el usuario
      if (error.message.includes('already registered')) {
        console.log('Usuario ya existe, obteniendo información...')
        
        // Buscar el perfil existente
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', (await supabase.auth.signInWithPassword({ email: devEmail, password: devPassword })).data.user?.id)
          .single()
        
        if (!profileError && profile) {
          return {
            user: {
              id: profile.id,
              email: devEmail,
              user_metadata: {
                full_name: profile.full_name
              }
            }
          }
        }
      }
      
      throw new Error(`Error al crear usuario: ${error.message}`)
    }
    
    console.log('Usuario creado exitosamente:', data)
    return data
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
  // Eliminar perfil elimina auth.user por ON DELETE? No, profiles referencia auth.users y se borra en cascada desde auth.
  // Con anon key no tenemos auth admin para borrar usuarios, así que limitamos a limpiar perfiles si política lo permite (no recomendable borrar perfiles sin usuario). Mejor no exponer.
  console.log('Attempting to remove profile for user:', userId)
  throw new Error('Eliminar usuarios requiere privilegios administrativos (service role) no disponibles en el frontend.')
}