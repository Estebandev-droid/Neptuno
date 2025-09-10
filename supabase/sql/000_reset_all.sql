-- 000_reset_all.sql
-- Reset TOTAL del proyecto en el esquema public (seguro para volver a correr todos los scripts)
-- No afecta esquemas auth ni storage ni extensiones globales. No borra buckets ni archivos.
-- Acciones:
-- 1) Borra TODAS las POLICIES de public y (opcional) storage.objects si el rol actual es owner
-- 2) Elimina TODAS las tablas del proyecto (public.*) con CASCADE
-- 3) Elimina funciones helper/API del proyecto en public

begin;

-- 1) Eliminar todas las políticas en el esquema public
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END
$do$ LANGUAGE plpgsql;

-- Eliminar políticas en storage.objects si el rol actual es owner
DO $do$
DECLARE v_is_owner boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND pg_get_userbyid(c.relowner) = current_user
  ) INTO v_is_owner;

  IF v_is_owner THEN
    EXECUTE 'drop policy if exists "Public read media" on storage.objects';
    EXECUTE 'drop policy if exists "Authenticated write media" on storage.objects';
    EXECUTE 'drop policy if exists "Admin update media" on storage.objects';
    EXECUTE 'drop policy if exists "Admin delete media" on storage.objects';
    EXECUTE 'drop policy if exists "Certificates read/write restricted" on storage.objects';
  ELSE
    RAISE NOTICE 'Omitiendo limpieza de storage.objects: el rol actual (%) no es owner', current_user;
  END IF;
END
$do$ LANGUAGE plpgsql;

-- 2) Eliminar tablas del proyecto (CASCADE)
-- Etapa base / catálogo
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.platform_admins CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.resources CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.evaluations CASCADE;
DROP TABLE IF EXISTS public.grades CASCADE;
DROP TABLE IF EXISTS public.certificates CASCADE;
DROP TABLE IF EXISTS public.analytics_events CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Gestión adicional
DROP TABLE IF EXISTS public.campuses CASCADE;
DROP TABLE IF EXISTS public.areas CASCADE;
DROP TABLE IF EXISTS public.parent_student_relationships CASCADE;
DROP TABLE IF EXISTS public.observations CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.admission_documents CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;

-- Formularios
DROP TABLE IF EXISTS public.forms CASCADE;
DROP TABLE IF EXISTS public.form_questions CASCADE;
DROP TABLE IF EXISTS public.question_options CASCADE;
DROP TABLE IF EXISTS public.form_responses CASCADE;
DROP TABLE IF EXISTS public.form_submissions CASCADE;

-- Contenido educativo
DROP TABLE IF EXISTS public.certificate_templates CASCADE;
DROP TABLE IF EXISTS public.course_modules CASCADE;
DROP TABLE IF EXISTS public.lessons CASCADE;
DROP TABLE IF EXISTS public.lesson_progress CASCADE;
DROP TABLE IF EXISTS public.parent_teacher_messages CASCADE;
DROP TABLE IF EXISTS public.class_schedules CASCADE;
DROP TABLE IF EXISTS public.resource_library CASCADE;

-- Etapa 1
DROP TABLE IF EXISTS public.academic_years CASCADE;
DROP TABLE IF EXISTS public.terms CASCADE;
DROP TABLE IF EXISTS public.classrooms CASCADE;
DROP TABLE IF EXISTS public.sections CASCADE;
DROP TABLE IF EXISTS public.course_instructors CASCADE;

-- Etapa 2
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.curriculum CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.notification_preferences CASCADE;

-- Etapa 3
DROP TABLE IF EXISTS public.question_bank CASCADE;
DROP TABLE IF EXISTS public.question_bank_options CASCADE;
DROP TABLE IF EXISTS public.rubrics CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.scholarships CASCADE;
DROP TABLE IF EXISTS public.student_scholarships CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;

-- Etapa 4
DROP TABLE IF EXISTS public.library_loans CASCADE;
DROP TABLE IF EXISTS public.badges CASCADE;
DROP TABLE IF EXISTS public.student_badges CASCADE;
DROP TABLE IF EXISTS public.student_points CASCADE;

-- 3) Eliminar funciones del proyecto (si existen)
-- Helpers y RLS utils
DROP FUNCTION IF EXISTS public.get_role(uuid);
DROP FUNCTION IF EXISTS public.is_platform_admin(uuid);
DROP FUNCTION IF EXISTS public.has_role(text, uuid);

-- Triggers genéricos
DROP FUNCTION IF EXISTS public.set_updated_at();
DROP FUNCTION IF EXISTS public.create_notification();
DROP FUNCTION IF EXISTS public.update_lesson_progress();
DROP FUNCTION IF EXISTS public.sync_platform_admins();
DROP FUNCTION IF EXISTS public.audit_trigger();

-- API/auxiliares previos
DROP FUNCTION IF EXISTS public.assign_user_role(uuid, text);
DROP FUNCTION IF EXISTS public.role_create(text);
DROP FUNCTION IF EXISTS public.role_delete(text);
DROP FUNCTION IF EXISTS public.role_rename(text, text);
DROP FUNCTION IF EXISTS public.user_role_assign(uuid, text);
DROP FUNCTION IF EXISTS public.user_role_revoke(uuid, text);
DROP FUNCTION IF EXISTS public.user_roles_list(uuid);

-- 2b) Asegurar eliminación de cualquier tabla remanente en public (genérico)
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('drop table if exists %I.%I cascade', r.schemaname, r.tablename);
  END LOOP;
END
$do$ LANGUAGE plpgsql;

commit;

-- Verificación manual sugerida:
-- select n.nspname, c.relname, c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by 1,2;