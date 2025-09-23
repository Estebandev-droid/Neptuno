import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // Aviso en tiempo de ejecución (no exponer secretos en logs)
  console.warn(
    '[Supabase] Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Configúralas en un archivo .env.local.'
  )
}

// Cliente de Supabase usando el esquema público por defecto, con refresh y persistencia de sesión habilitados
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// Cliente admin para operaciones que requieren privilegios elevados
// IMPORTANTE: Solo usar en el servidor o en operaciones administrativas seguras
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null