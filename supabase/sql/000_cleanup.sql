-- =============================================
-- SCRIPT DE LIMPIEZA COMPLETA DE BASE DE DATOS
-- =============================================
-- ADVERTENCIA: Este script eliminará TODOS los datos y estructuras
-- Solo usar en desarrollo o para reset completo
-- =============================================

-- Deshabilitar RLS temporalmente para evitar errores
set session_replication_role = replica;

-- =============================================
-- ELIMINAR BUCKETS DE STORAGE
-- =============================================

-- Eliminar todos los objetos de los buckets primero
delete from storage.objects where bucket_id in ('course-covers', 'resource-files', 'tenant-logos');

-- Eliminar los buckets
delete from storage.buckets where id in ('course-covers', 'resource-files', 'tenant-logos');

-- =============================================
-- ELIMINAR POLÍTICAS RLS
-- =============================================

-- Eliminar políticas de storage
drop policy if exists "Lectura pública de portadas de cursos" on storage.objects;
drop policy if exists "Usuarios autenticados pueden subir portadas" on storage.objects;
drop policy if exists "Usuarios pueden actualizar sus propias portadas" on storage.objects;
drop policy if exists "Usuarios pueden eliminar sus propias portadas" on storage.objects;
drop policy if exists "Usuarios autenticados pueden ver recursos" on storage.objects;
drop policy if exists "Usuarios autenticados pueden subir recursos" on storage.objects;
drop policy if exists "Usuarios pueden actualizar sus propios recursos" on storage.objects;
drop policy if exists "Usuarios pueden eliminar sus propios recursos" on storage.objects;
drop policy if exists "Lectura pública de logos de tenants" on storage.objects;
drop policy if exists "Usuarios autenticados pueden subir logos" on storage.objects;
drop policy if exists "Usuarios pueden actualizar logos de su tenant" on storage.objects;
drop policy if exists "Usuarios pueden eliminar logos de su tenant" on storage.objects;

-- Eliminar todas las políticas de las tablas principales
do $$
declare
    r record;
begin
    -- Obtener todas las políticas de las tablas del esquema public
    for r in (
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
    ) loop
        execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    end loop;
end $$;

-- =============================================
-- ELIMINAR TRIGGERS
-- =============================================

-- Eliminar triggers de updated_at
drop trigger if exists trg_tenants_updated_at on public.tenants;
drop trigger if exists trg_profiles_updated_at on public.profiles;
drop trigger if exists trg_courses_updated_at on public.courses;
drop trigger if exists trg_enrollments_updated_at on public.enrollments;
drop trigger if exists trg_resources_updated_at on public.resources;
drop trigger if exists trg_grades_updated_at on public.grades;
drop trigger if exists trg_evaluations_updated_at on public.evaluations;
drop trigger if exists trg_evaluation_questions_updated_at on public.evaluation_questions;
drop trigger if exists trg_certificates_updated_at on public.certificates;
drop trigger if exists trg_certificate_templates_updated_at on public.certificate_templates;
drop trigger if exists trg_notifications_updated_at on public.notifications;
-- Triggers adicionales que pueden existir
drop trigger if exists trg_categories_updated_at on public.categories;
drop trigger if exists trg_tasks_updated_at on public.tasks;
drop trigger if exists trg_submissions_updated_at on public.submissions;
drop trigger if exists trg_relationships_updated_at on public.relationships;
drop trigger if exists set_certificate_templates_updated_at on public.certificate_templates;

-- Eliminar triggers de auditoría
drop trigger if exists audit_trigger_courses on public.courses;
drop trigger if exists audit_trigger_enrollments on public.enrollments;
drop trigger if exists audit_trigger_grades on public.grades;

-- Eliminar trigger de nuevos usuarios
drop trigger if exists on_auth_user_created on auth.users;

-- =============================================
-- ELIMINAR FUNCIONES RPC
-- =============================================

-- Funciones de evaluaciones
drop function if exists public.get_evaluation_with_questions(uuid);
drop function if exists public.start_evaluation_attempt(uuid, uuid, uuid);
drop function if exists public.auto_grade_evaluation(uuid);

-- Funciones de notificaciones
drop function if exists public.create_notification(uuid, uuid, text, text, text);
drop function if exists public.get_user_notifications(uuid, uuid, boolean, text, integer, integer);
drop function if exists public.mark_notification_read(uuid, uuid);
drop function if exists public.mark_all_notifications_read(uuid, uuid);
drop function if exists public.delete_notification(uuid, uuid);

-- Funciones de certificados
drop function if exists public.issue_certificate(uuid, uuid, uuid, jsonb, text, uuid);
drop function if exists public.get_certificates(uuid, uuid, integer, integer);
drop function if exists public.get_certificate_templates(uuid, boolean, integer, integer);
drop function if exists public.insert_certificate_template(uuid, text, text, jsonb, boolean);
drop function if exists public.update_certificate_template(uuid, text, text, jsonb, boolean);
drop function if exists public.delete_certificate_template(uuid);

-- Las funciones de administración se eliminan con CASCADE al final

-- Funciones utilitarias (usar CASCADE para eliminar dependencias)
drop function if exists public.set_updated_at() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.sync_platform_admins() cascade;
drop function if exists public.audit_trigger() cascade;

-- Funciones de administración (usar CASCADE para eliminar dependencias)
drop function if exists public.get_role(uuid) cascade;
drop function if exists public.is_platform_admin(uuid) cascade;
drop function if exists public.has_role(text, uuid) cascade;
drop function if exists public.role_create(text, text) cascade;
drop function if exists public.role_rename(uuid, text) cascade;
drop function if exists public.role_delete(uuid) cascade;
drop function if exists public.user_role_assign(uuid, text) cascade;

-- =============================================
-- ELIMINAR TABLAS EN ORDEN CORRECTO
-- =============================================

-- Eliminar tablas con foreign keys primero
drop table if exists public.student_answers cascade;
drop table if exists public.evaluation_attempts cascade;
drop table if exists public.evaluation_questions cascade;
drop table if exists public.certificates cascade;
drop table if exists public.grades cascade;
drop table if exists public.resources cascade;
drop table if exists public.enrollments cascade;
drop table if exists public.evaluations cascade;
drop table if exists public.courses cascade;
drop table if exists public.notifications cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.profiles cascade;

-- Eliminar tablas adicionales que pueden existir
drop table if exists public.categories cascade;
drop table if exists public.tasks cascade;
drop table if exists public.submissions cascade;
drop table if exists public.relationships cascade;

-- Eliminar tablas de configuración
drop table if exists public.certificate_templates cascade;
drop table if exists public.roles cascade;
drop table if exists public.tenants cascade;
drop table if exists public.audit_log cascade;
drop table if exists public.platform_admins cascade;

-- Eliminar tabla de memberships del modelo multi-tenant
drop table if exists public.memberships cascade;

-- =============================================
-- ELIMINAR ÍNDICES PERSONALIZADOS
-- =============================================

-- Los índices se eliminan automáticamente con las tablas,
-- pero por si acaso eliminamos índices huérfanos
do $$
declare
    r record;
begin
    for r in (
        select indexname
        from pg_indexes
        where schemaname = 'public'
        and indexname like 'idx_%'
    ) loop
        execute format('drop index if exists public.%I', r.indexname);
    end loop;
end $$;

-- =============================================
-- LIMPIAR DATOS DE AUTH (OPCIONAL)
-- =============================================

-- ADVERTENCIA: Esto eliminará todos los usuarios
-- Descomenta solo si quieres eliminar usuarios también

-- delete from auth.users;
-- delete from auth.identities;
-- delete from auth.sessions;
-- delete from auth.refresh_tokens;

-- =============================================
-- RESTAURAR CONFIGURACIÓN
-- =============================================

-- Restaurar session_replication_role
set session_replication_role = default;

-- Confirmar cambios
commit;

-- =============================================
-- VERIFICACIÓN DE LIMPIEZA
-- =============================================

-- Mostrar tablas restantes en public
select 'Tablas restantes en public:' as info;
select tablename from pg_tables where schemaname = 'public';

-- Mostrar funciones restantes en public
select 'Funciones restantes en public:' as info;
select routine_name from information_schema.routines 
where routine_schema = 'public' and routine_type = 'FUNCTION';

-- Mostrar buckets restantes
select 'Buckets restantes:' as info;
select id, name from storage.buckets;

select '¡Limpieza completa finalizada!' as resultado;