-- =============================================
-- 003_seed.sql
-- Seed inicial y seguro para Neptuno (idempotente)
-- Crea roles base, un tenant demo, categorías demo y un curso/recursos/tareas de ejemplo
-- También asigna el rol superadmin al primer usuario existente en auth.users
-- =============================================

BEGIN;

-- 1) Roles base (no se vuelven a insertar si ya existen)
INSERT INTO public.roles (name, description, is_system)
VALUES
  ('superadmin','Super Administrador del sistema', true),
  ('platform_admin','Administrador global de la plataforma', true),
  ('tenant_admin','Administrador de institución', true),
  ('teacher','Docente de cursos', true),
  ('student','Estudiante registrado', true),
  ('parent','Padre o acudiente', true)
ON CONFLICT (name) DO NOTHING;

-- 2) Tenant de ejemplo (único por dominio)
INSERT INTO public.tenants (name, domain, branding, plan)
VALUES (
  'Institución Demo',
  'demo.neptuno.edu',
  '{"logo_url":"https://demo.neptuno.edu/logo.png","primary_color":"#0033CC"}',
  'basic'
)
ON CONFLICT (domain) DO NOTHING;

-- 3) Categoría por defecto (General) para el tenant demo
DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE domain = 'demo.neptuno.edu' LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.categories (tenant_id, name, description, is_active)
    VALUES (v_tenant_id, 'General', 'Categoría por defecto', true)
    ON CONFLICT (tenant_id, name) DO NOTHING;
  END IF;
END $$;

-- 4) Asignar superadmin al primer usuario registrado (si existe alguno)
CREATE OR REPLACE FUNCTION public.assign_superadmin_to_existing_user()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id uuid;
  v_superadmin_role_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO v_superadmin_role_id FROM public.roles WHERE name = 'superadmin';

  IF v_user_id IS NOT NULL AND v_superadmin_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_user_id, v_superadmin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- Crear perfil si no existe
    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', split_part(email,'@',1)), 'super_admin', true
    FROM auth.users WHERE id = v_user_id
    ON CONFLICT (id) DO NOTHING;
  END IF;
END; $$;

SELECT public.assign_superadmin_to_existing_user();

-- 5) Curso/Recursos/Tareas de ejemplo para el tenant demo
DO $$
DECLARE
  v_tenant_id uuid;
  v_category_id uuid;
  v_course_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE domain = 'demo.neptuno.edu' LIMIT 1;
  SELECT id INTO v_category_id FROM public.categories WHERE tenant_id = v_tenant_id AND name = 'General' LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    -- Curso demo (si no existe)
    INSERT INTO public.courses (tenant_id, title, description, cover_image, category_id, is_active)
    VALUES (
      v_tenant_id,
      'Curso de Bienvenida',
      'Curso introductorio para nuevos estudiantes.',
      'https://demo.neptuno.edu/images/course_cover.png',
      v_category_id,
      true
    )
    ON CONFLICT DO NOTHING;

    -- Obtener id del curso (insertado o existente)
    SELECT id INTO v_course_id FROM public.courses 
    WHERE tenant_id = v_tenant_id AND title = 'Curso de Bienvenida' LIMIT 1;

    -- Recurso demo (solo si no existe)
    IF v_course_id IS NOT NULL THEN
      INSERT INTO public.resources (tenant_id, course_id, title, description, resource_type, file_url, is_public)
      SELECT v_tenant_id, v_course_id, 
             'Guía de Introducción', 
             'Documento PDF con información básica de la plataforma', 
             'document',
             'https://demo.neptuno.edu/resources/guia.pdf', true
      WHERE NOT EXISTS (
        SELECT 1 FROM public.resources 
        WHERE course_id = v_course_id AND title = 'Guía de Introducción'
      );

      -- Tarea demo (solo si no existe)
      INSERT INTO public.tasks (tenant_id, course_id, title, description, due_date, max_score, is_published)
      SELECT v_tenant_id, v_course_id,
             'Primera Actividad', 
             'Responde el cuestionario inicial para conocerte mejor',
             now() + interval '7 days', 100, true
      WHERE NOT EXISTS (
        SELECT 1 FROM public.tasks 
        WHERE course_id = v_course_id AND title = 'Primera Actividad'
      );
    END IF;
  END IF;
END $$;

-- 6) Crear memberships para usuarios existentes
-- Esto asigna memberships a usuarios que ya tienen profiles con tenant_id
DO $$
DECLARE
  v_profile RECORD;
  v_tenant_id uuid;
BEGIN
  -- Migrar usuarios existentes con tenant_id a memberships
  FOR v_profile IN 
    SELECT id, tenant_id, role 
    FROM public.profiles 
    WHERE tenant_id IS NOT NULL
  LOOP
    -- Crear membership si no existe
    INSERT INTO public.memberships (user_id, tenant_id, role, is_active)
    VALUES (
      v_profile.id, 
      v_profile.tenant_id, 
      CASE 
        WHEN v_profile.role = 'super_admin' THEN 'owner'
        WHEN v_profile.role = 'tenant_admin' THEN 'admin'
        WHEN v_profile.role = 'teacher' THEN 'teacher'
        WHEN v_profile.role = 'student' THEN 'student'
        WHEN v_profile.role = 'parent' THEN 'parent'
        ELSE 'student'
      END,
      true
    )
    ON CONFLICT (user_id, tenant_id) DO NOTHING;
  END LOOP;
  
  -- Crear membership para el superadmin en el tenant demo
  SELECT id INTO v_tenant_id FROM public.tenants WHERE domain = 'demo.neptuno.edu' LIMIT 1;
  
  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.memberships (user_id, tenant_id, role, is_active)
    SELECT 
      p.id,
      v_tenant_id,
      'owner',
      true
    FROM public.profiles p
    WHERE p.role = 'super_admin'
    ON CONFLICT (user_id, tenant_id) DO NOTHING;
  END IF;
END $$;

COMMIT;
