// Script de depuración para verificar permisos y datos en Supabase
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xkqdbhkyttdglwumcoqi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcWRiaGt5dHRkZ2x3dW1jb3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMzc1NzksImV4cCI6MjA3MjkxMzU3OX0.hbM55V76votV7GsO5P_8BkYk9nRgxtM5BgH9hC5MvFs'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugPermissions() {
  console.log('=== DEPURACIÓN DE PERMISOS SUPABASE ===')
  
  try {
    // 1. Verificar autenticación actual
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('\n1. SESIÓN ACTUAL:')
    if (sessionError) {
      console.error('Error al obtener sesión:', sessionError)
    } else if (session) {
      console.log('Usuario autenticado:', session.user.email)
      console.log('ID de usuario:', session.user.id)
    } else {
      console.log('No hay usuario autenticado')
    }

    // 2. Intentar login con credenciales de admin
    console.log('\n2. INTENTANDO LOGIN CON ADMIN:')
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'esteban@gmail.com',
      password: 'admin123' // Asumiendo esta contraseña, cambiar si es diferente
    })
    
    if (loginError) {
      console.error('Error en login:', loginError.message)
      return
    } else {
      console.log('Login exitoso para:', loginData.user.email)
    }

    // 3. Verificar perfiles disponibles
    console.log('\n3. CONSULTANDO PERFILES:')
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (profilesError) {
      console.error('Error al consultar perfiles:', profilesError)
    } else {
      console.log('Perfiles encontrados:', profiles?.length || 0)
      profiles?.forEach(profile => {
        console.log(`- ${profile.full_name} (${profile.email}) - ID: ${profile.id}`)
      })
    }

    // 4. Verificar roles disponibles
    console.log('\n4. CONSULTANDO ROLES:')
    const { data: roles, error: rolesError } = await supabase
      .rpc('list_available_roles')
    
    if (rolesError) {
      console.error('Error al consultar roles:', rolesError)
    } else {
      console.log('Roles encontrados:', roles?.length || 0)
      roles?.forEach(role => {
        console.log(`- ${role.role_name}: ${role.description}`)
      })
    }

    // 5. Verificar si el usuario actual es admin
    console.log('\n5. VERIFICANDO PERMISOS DE ADMIN:')
    const { data: adminCheck, error: adminError } = await supabase
      .rpc('is_platform_admin')
    
    if (adminError) {
      console.error('Error al verificar admin:', adminError)
    } else {
      console.log('¿Es admin de plataforma?:', adminCheck)
    }

    // 6. Verificar asignaciones de roles del usuario actual
    console.log('\n6. ROLES DEL USUARIO ACTUAL:')
    const currentUserId = (await supabase.auth.getUser()).data.user?.id
    if (currentUserId) {
      const { data: userRoles, error: userRolesError } = await supabase
        .rpc('user_roles_list', { p_user: currentUserId })
      
      if (userRolesError) {
        console.error('Error al obtener roles del usuario:', userRolesError)
      } else {
        console.log('Roles asignados:', userRoles)
      }
    }

  } catch (error) {
    console.error('Error general:', error)
  }
}

// Ejecutar depuración
debugPermissions()