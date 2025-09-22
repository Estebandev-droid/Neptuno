-- =============================================
-- 003_seed.sql
-- Seed inicial y seguro para Neptuno (idempotente)
-- Crea roles base, un tenant demo, categorías demo y un curso/recursos/tareas de ejemplo
-- También asigna el rol superadmin al primer usuario existente en auth.users
-- =============================================

BEGIN;

-- 1) Nota: Los roles ahora se manejan directamente en profiles.role y memberships.role
-- No se necesita tabla separada de roles

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
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Crear perfil si no existe
    INSERT INTO public.profiles (id, full_name, role, is_active)
    SELECT id, COALESCE(raw_user_meta_data->>'full_name', split_part(email,'@',1)), 'super_admin', true
    FROM auth.users WHERE id = v_user_id
    ON CONFLICT (id) DO NOTHING;
    
    -- Agregar a platform_admins
    INSERT INTO public.platform_admins (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;
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

-- =============================================
-- DATOS DE EJEMPLO PARA FUNCIONALIDADES AVANZADAS
-- =============================================

-- 7) Clases en vivo de ejemplo
DO $$
DECLARE
  v_tenant_id uuid;
  v_course_id uuid;
  v_live_class_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE domain = 'demo.neptuno.edu' LIMIT 1;
  SELECT id INTO v_course_id FROM public.courses WHERE tenant_id = v_tenant_id AND title = 'Curso de Bienvenida' LIMIT 1;

  IF v_course_id IS NOT NULL THEN
    -- Obtener el primer usuario como instructor
    DECLARE
      v_instructor_id uuid;
    BEGIN
      SELECT id INTO v_instructor_id FROM auth.users ORDER BY created_at LIMIT 1;
      
      IF v_instructor_id IS NOT NULL THEN
        -- Clase en vivo programada
        INSERT INTO public.live_classes (tenant_id, course_id, instructor_id, title, description, scheduled_start, scheduled_end, status)
         VALUES (
           v_tenant_id,
           v_course_id,
           v_instructor_id,
           'Sesión de Bienvenida',
           'Primera clase en vivo para conocer la plataforma',
           now() + interval '1 day',
           now() + interval '1 day' + interval '60 minutes',
           'scheduled'
         )
         ON CONFLICT DO NOTHING
         RETURNING id INTO v_live_class_id;

         -- Si no se insertó, obtener el ID existente
         IF v_live_class_id IS NULL THEN
           SELECT id INTO v_live_class_id FROM public.live_classes 
           WHERE course_id = v_course_id AND title = 'Sesión de Bienvenida' LIMIT 1;
         END IF;
       END IF;
     END;
  END IF;
END $$;

-- 8) Comentarios y discusiones de ejemplo
DO $$
DECLARE
  v_tenant_id uuid;
  v_course_id uuid;
  v_user_id uuid;
  v_task_id uuid;
  v_discussion_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE domain = 'demo.neptuno.edu' LIMIT 1;
  
  SELECT c.id INTO v_course_id FROM public.courses c
  JOIN public.tenants t ON t.id = c.tenant_id
  WHERE t.domain = 'demo.neptuno.edu' AND c.title = 'Curso de Bienvenida' LIMIT 1;
  
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;

  IF v_course_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    -- Discusión de curso
    INSERT INTO public.course_discussions (course_id, title, content, user_id)
    VALUES (
      v_course_id,
      'Presentaciones',
      'Espacio para que los estudiantes se presenten',
      v_user_id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_discussion_id;

    -- Si no se insertó, obtener el ID existente
    IF v_discussion_id IS NULL THEN
      SELECT id INTO v_discussion_id FROM public.course_discussions 
      WHERE course_id = v_course_id AND title = 'Presentaciones' LIMIT 1;
    END IF;

    -- Comentario en la discusión (como respuesta)
    IF v_discussion_id IS NOT NULL THEN
      INSERT INTO public.course_discussions (tenant_id, course_id, user_id, parent_id, content, discussion_type)
      VALUES (
        v_tenant_id,
        v_course_id,
        v_user_id,
        v_discussion_id,
        '¡Hola a todos! Soy el instructor de este curso. ¡Bienvenidos!',
        'general'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- 9) Grupos de tareas y progreso avanzado
DO $$
DECLARE
  v_course_id uuid;
  v_task_id uuid;
  v_group_id uuid;
  v_user_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT c.id, c.tenant_id INTO v_course_id, v_tenant_id FROM public.courses c
  JOIN public.tenants t ON t.id = c.tenant_id
  WHERE t.domain = 'demo.neptuno.edu' AND c.title = 'Curso de Bienvenida' LIMIT 1;
  
  SELECT id INTO v_task_id FROM public.tasks WHERE course_id = v_course_id LIMIT 1;
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;

  IF v_course_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    -- Crear tarea inicial primero
    INSERT INTO public.tasks (tenant_id, course_id, title, description, task_type)
    VALUES (
      v_tenant_id,
      v_course_id,
      'Actividad Inicial',
      'Tarea para familiarizarse con la plataforma',
      'assignment'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_task_id;
    
    -- Grupo de tareas (requiere task_id)
    IF v_task_id IS NOT NULL THEN
      INSERT INTO public.task_groups (task_id, name, description, created_by)
      VALUES (
        v_task_id,
        'Actividades Iniciales',
        'Grupo de tareas para familiarizarse con la plataforma',
        v_user_id
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_group_id;
    END IF;

    -- Progreso de tarea (si existe una tarea)
    IF v_task_id IS NOT NULL THEN
      INSERT INTO public.task_progress (task_id, student_id, status, progress_percentage)
      VALUES (
        v_task_id,
        v_user_id,
        'in_progress',
        25
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- 10) Métricas de engagement y alertas
DO $$
DECLARE
  v_user_id uuid;
  v_course_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT c.id INTO v_course_id FROM public.courses c
  JOIN public.tenants t ON t.id = c.tenant_id
  WHERE t.domain = 'demo.neptuno.edu' AND c.title = 'Curso de Bienvenida' LIMIT 1;

  IF v_user_id IS NOT NULL AND v_course_id IS NOT NULL THEN
    -- Métricas de engagement
    INSERT INTO public.student_engagement_metrics (tenant_id, student_id, course_id, date, login_count, total_time_minutes)
    VALUES (
      (SELECT tenant_id FROM public.courses WHERE id = v_course_id),
      v_user_id,
      v_course_id,
      current_date,
      5,
      120
    )
    ON CONFLICT (student_id, course_id, date) DO UPDATE SET
      login_count = EXCLUDED.login_count,
      total_time_minutes = EXCLUDED.total_time_minutes;

    -- Alerta de riesgo académico (ejemplo)
    INSERT INTO public.academic_risk_alerts (tenant_id, student_id, course_id, risk_type, risk_level, description)
    VALUES (
      (SELECT tenant_id FROM public.courses WHERE id = v_course_id),
      v_user_id,
      v_course_id,
      'low_engagement',
      'low',
      'Estudiante con bajo riesgo - monitoreo inicial'
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 11) Sistema de gamificación
DO $$
DECLARE
  v_user_id uuid;
  v_course_id uuid;
  v_achievement_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT c.id INTO v_course_id FROM public.courses c
  JOIN public.tenants t ON t.id = c.tenant_id
  WHERE t.domain = 'demo.neptuno.edu' AND c.title = 'Curso de Bienvenida' LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Logros disponibles (solo si no existen)
    INSERT INTO public.achievements (tenant_id, name, description, badge_icon, points_value, criteria)
    SELECT tenant_id, name, description, badge_icon, points_value, criteria::jsonb
    FROM (
      VALUES 
        ((SELECT tenant_id FROM public.courses WHERE id = v_course_id), 'Primer Paso', 'Completaste tu primer inicio de sesión', '/icons/first-step.svg', 10, '{"type": "login", "count": 1}'),
        ((SELECT tenant_id FROM public.courses WHERE id = v_course_id), 'Estudiante Activo', 'Iniciaste sesión 5 veces', '/icons/active-student.svg', 25, '{"type": "login", "count": 5}'),
        ((SELECT tenant_id FROM public.courses WHERE id = v_course_id), 'Participativo', 'Escribiste tu primer comentario', '/icons/participative.svg', 15, '{"type": "comment", "count": 1}')
    ) AS new_achievements(tenant_id, name, description, badge_icon, points_value, criteria)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.achievements a 
      WHERE a.tenant_id = new_achievements.tenant_id 
        AND a.name = new_achievements.name
    );

    -- Otorgar logro inicial
    SELECT id INTO v_achievement_id FROM public.achievements 
    WHERE name = 'Primer Paso' AND tenant_id = (SELECT tenant_id FROM public.courses WHERE id = v_course_id) LIMIT 1;
    
    IF v_achievement_id IS NOT NULL THEN
      INSERT INTO public.student_achievements (student_id, achievement_id, course_id, points_earned)
      VALUES (v_user_id, v_achievement_id, v_course_id, 10)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Puntos iniciales del estudiante
    INSERT INTO public.student_points (tenant_id, student_id, course_id, total_points, level_number)
    VALUES ((SELECT tenant_id FROM public.courses WHERE id = v_course_id), v_user_id, v_course_id, 10, 1)
    ON CONFLICT (student_id, course_id) DO UPDATE SET
      total_points = EXCLUDED.total_points,
      level_number = EXCLUDED.level_number;
  END IF;
END $$;

-- 12) Sesiones de estudio
DO $$
DECLARE
  v_user_id uuid;
  v_course_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT c.id INTO v_course_id FROM public.courses c
  JOIN public.tenants t ON t.id = c.tenant_id
  WHERE t.domain = 'demo.neptuno.edu' AND c.title = 'Curso de Bienvenida' LIMIT 1;

  IF v_user_id IS NOT NULL AND v_course_id IS NOT NULL THEN
    -- Sesión de estudio de ejemplo
    INSERT INTO public.study_sessions (facilitator_id, course_id, title, start_time, end_time)
    VALUES (
      v_user_id,
      v_course_id,
      'Sesión de Estudio Demo',
      now() - interval '2 hours',
      now() - interval '1 hour 15 minutes'
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 13) Datos adicionales para demostración
DO $$
DECLARE
  v_tenant_id uuid;
  v_category_id uuid;
  v_advanced_course_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE domain = 'demo.neptuno.edu' LIMIT 1;
  SELECT id INTO v_category_id FROM public.categories WHERE tenant_id = v_tenant_id AND name = 'General' LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    -- Curso avanzado adicional
    INSERT INTO public.courses (tenant_id, title, description, cover_image, category_id, is_active)
    VALUES (
      v_tenant_id,
      'Matemáticas Avanzadas',
      'Curso de matemáticas con funcionalidades interactivas',
      'https://demo.neptuno.edu/images/math_course.png',
      v_category_id,
      true
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_advanced_course_id;

    -- Si no se insertó, obtener el ID existente
    IF v_advanced_course_id IS NULL THEN
      SELECT id INTO v_advanced_course_id FROM public.courses 
      WHERE tenant_id = v_tenant_id AND title = 'Matemáticas Avanzadas' LIMIT 1;
    END IF;

    -- Tarea con grupo para el curso avanzado
    IF v_advanced_course_id IS NOT NULL THEN
      INSERT INTO public.tasks (tenant_id, course_id, title, description, due_date, max_score, is_published, task_type)
      VALUES (
        v_tenant_id,
        v_advanced_course_id,
        'Proyecto Colaborativo',
        'Trabajo en equipo para resolver problemas matemáticos',
        now() + interval '14 days',
        200,
        true,
        'project'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

COMMIT;
