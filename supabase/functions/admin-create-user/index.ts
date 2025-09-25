// Supabase Edge Function: admin-create-user
// Crea usuarios usando la service role key, valida que el solicitante sea admin y maneja CORS

// @ts-nocheck
// Edge Function de Supabase corre en Deno; estas importaciones por URL y el global Deno son válidos en tiempo de ejecución.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // En producción, restringe al dominio de tu app
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req: Request): Promise<Response> => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "Método no permitido" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const authHeader = req.headers.get("Authorization") || ""
    const jwt = authHeader.replace("Bearer ", "").trim()
    if (!jwt) {
      return new Response(JSON.stringify({ success: false, error: "Falta encabezado Authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({
        success: false,
        error: "Faltan variables de entorno SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY",
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // Cliente con el JWT del usuario para validar permisos y leer su perfil
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${jwt}` },
      },
    })

    // Validar que el solicitante sea admin de plataforma/tenant
    const { data: isAdmin, error: adminCheckError } = await userClient.rpc("is_platform_admin")
    if (adminCheckError) {
      return new Response(JSON.stringify({ success: false, error: adminCheckError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Solo administradores pueden crear usuarios" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // Obtener tenant del administrador (para asignar el nuevo usuario a ese tenant)
    const { data: adminProfile, error: profileError } = await userClient
      .from("profiles")
      .select("tenant_id")
      .single()

    if (profileError) {
      return new Response(JSON.stringify({ success: false, error: profileError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const adminTenantId = adminProfile?.tenant_id as string | null

    const payload = await req.json()
    const email: string = String(payload?.email || "").trim().toLowerCase()
    const password: string = String(payload?.password || "")
    const fullName: string | undefined = payload?.fullName?.trim() || undefined
    const roleName: string = String(payload?.roleName || "student")
    const phone: string | undefined = payload?.phone || undefined
    const signatureUrl: string | undefined = payload?.signatureUrl || undefined
    const photoUrl: string | undefined = payload?.photoUrl || undefined

    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, error: "Email y contraseña son requeridos" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ success: false, error: "La contraseña debe tener al menos 6 caracteres" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // Cliente admin con service role para crear el usuario
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Crear usuario en auth.users
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName ?? email.split("@")[0],
        role: roleName,
        created_by_admin: true,
        phone,
        signature_url: signatureUrl,
        photo_url: photoUrl,
      },
    })

    if (createError) {
      return new Response(JSON.stringify({ success: false, error: createError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const newUserId = created.user?.id

    // Alinear perfil y membresía con el tenant del admin (si existe)
    if (newUserId && adminTenantId) {
      // Actualizar perfil (el trigger handle_new_user ya creó uno con rol/tenant por defecto)
      await adminClient
        .from("profiles")
        .update({
          full_name: fullName ?? email.split("@")[0],
          role: roleName,
          tenant_id: adminTenantId,
          is_active: true,
        })
        .eq("id", newUserId)

      // Crear/actualizar membresía en el tenant del admin
      await adminClient
        .from("memberships")
        .upsert({
          user_id: newUserId,
          tenant_id: adminTenantId,
          role: roleName,
          is_active: true,
          permissions: {},
        }, { onConflict: "user_id,tenant_id" })
    }

    return new Response(JSON.stringify({
      success: true,
      user: { id: newUserId, email },
      message: "Usuario creado exitosamente",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
})