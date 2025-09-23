-- =============================================
-- SCRIPT DE LIMPIEZA COMPLETA DE BASE DE DATOS
-- =============================================
-- ADVERTENCIA: Este script eliminará TODOS los datos y estructuras
-- Solo usar en desarrollo o para reset completo
-- Orden de ejecución: 000_cleanup.sql -> 001_schema.sql -> 002_functions.sql -> 003_policies.sql -> 004_storage.sql -> 005_seed.sql -> 006_roles.sql
-- =============================================

    -- Deshabilitar RLS temporalmente para evitar errores
    set session_replication_role = replica;

    -- =============================================
    -- ELIMINAR BUCKETS DE STORAGE
    -- =============================================

    -- Eliminar todos los objetos de los buckets primero
    delete from storage.objects where bucket_id in (
    'course-covers', 
    'resource-files', 
    'tenant-logos',
    'user-avatars',
    'user-signatures',
    'live-recordings',
    'live-resources',
    'task-submissions',
    'avatars-hd',
    'certificates-custom',
    'exports'
    );

    -- Eliminar los buckets
    delete from storage.buckets where id in (
    'course-covers', 
    'resource-files', 
    'tenant-logos',
    'user-avatars',
    'user-signatures',
    'live-recordings',
    'live-resources',
    'task-submissions',
    'avatars-hd',
    'certificates-custom',
    'exports'
    );

    -- =============================================
    -- ELIMINAR POLÍTICAS RLS
    -- =============================================

    -- Eliminar todas las políticas de storage de forma dinámica
    do $$
    declare
        r record;
    begin
        -- Eliminar todas las políticas de storage.objects
        for r in (
            select policyname
            from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
        ) loop
            execute format('drop policy if exists %I on storage.objects', r.policyname);
        end loop;
    end $$;

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

    -- Eliminar triggers de updated_at (solo si las tablas existen)
    do $$
    begin
        -- Eliminar triggers solo si las tablas existen
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tenants') then
            drop trigger if exists trg_tenants_updated_at on public.tenants;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
            drop trigger if exists trg_profiles_updated_at on public.profiles;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'courses') then
            drop trigger if exists trg_courses_updated_at on public.courses;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'enrollments') then
            drop trigger if exists trg_enrollments_updated_at on public.enrollments;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'resources') then
            drop trigger if exists trg_resources_updated_at on public.resources;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'grades') then
            drop trigger if exists trg_grades_updated_at on public.grades;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'evaluations') then
            drop trigger if exists trg_evaluations_updated_at on public.evaluations;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'evaluation_questions') then
            drop trigger if exists trg_evaluation_questions_updated_at on public.evaluation_questions;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'certificates') then
            drop trigger if exists trg_certificates_updated_at on public.certificates;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'certificate_templates') then
            drop trigger if exists trg_certificate_templates_updated_at on public.certificate_templates;
            drop trigger if exists set_certificate_templates_updated_at on public.certificate_templates;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications') then
            drop trigger if exists trg_notifications_updated_at on public.notifications;
        end if;
        -- Triggers adicionales que pueden existir
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'categories') then
            drop trigger if exists trg_categories_updated_at on public.categories;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tasks') then
            drop trigger if exists trg_tasks_updated_at on public.tasks;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'submissions') then
            drop trigger if exists trg_submissions_updated_at on public.submissions;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'relationships') then
            drop trigger if exists trg_relationships_updated_at on public.relationships;
        end if;
        -- Triggers para tablas de clases en vivo y sesiones
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'live_classes') then
            drop trigger if exists trg_live_classes_updated_at on public.live_classes;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'study_sessions') then
            drop trigger if exists trg_study_sessions_updated_at on public.study_sessions;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'live_class_comments') then
            drop trigger if exists trg_live_class_comments_updated_at on public.live_class_comments;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'course_discussions') then
            drop trigger if exists trg_course_discussions_updated_at on public.course_discussions;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'task_progress') then
            drop trigger if exists trg_task_progress_updated_at on public.task_progress;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_points') then
            drop trigger if exists trg_student_points_updated_at on public.student_points;
        end if;
        -- Triggers adicionales de memberships
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'memberships') then
            drop trigger if exists trg_memberships_updated_at on public.memberships;
        end if;
    end $$;

    -- Eliminar triggers de auditoría (solo si las tablas existen)
    do $$
    begin
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'courses') then
            drop trigger if exists audit_trigger_courses on public.courses;
            drop trigger if exists audit_courses on public.courses;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'enrollments') then
            drop trigger if exists audit_trigger_enrollments on public.enrollments;
            drop trigger if exists audit_enrollments on public.enrollments;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'grades') then
            drop trigger if exists audit_trigger_grades on public.grades;
            drop trigger if exists audit_grades on public.grades;
        end if;
    end $$;

    -- Eliminar triggers de notificaciones (solo si las tablas existen)
    do $$
    begin
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tasks') then
            drop trigger if exists tasks_notification_trigger on public.tasks;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'grades') then
            drop trigger if exists grades_notification_trigger on public.grades;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
            drop trigger if exists trg_profiles_sync_pa on public.profiles;
        end if;
    end $$;

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

    -- Eliminar todas las funciones restantes del esquema public (excepto las del sistema)
    do $$
    declare
        r record;
    begin
        for r in (
            select routine_name, routine_schema
            from information_schema.routines
            where routine_schema = 'public' 
            and routine_type = 'FUNCTION'
            -- Excluir funciones del sistema que son requeridas por extensiones
            and routine_name not in (
                'gen_random_uuid', 'uuid_generate_v1', 'uuid_generate_v1mc', 
                'uuid_generate_v3', 'uuid_generate_v4', 'uuid_generate_v5',
                'uuid_nil', 'uuid_ns_dns', 'uuid_ns_oid', 'uuid_ns_url', 'uuid_ns_x500',
                'crypt', 'gen_salt', 'encrypt', 'decrypt', 'encrypt_iv', 'decrypt_iv',
                'hmac', 'digest', 'gen_random_bytes'
            )
        ) loop
            execute format('drop function if exists %I.%I() cascade', r.routine_schema, r.routine_name);
        end loop;
    end $$;

    -- Eliminar todas las vistas del esquema public
    do $$
    declare
        r record;
    begin
        for r in (
            select table_name
            from information_schema.views
            where table_schema = 'public'
        ) loop
            execute format('drop view if exists public.%I cascade', r.table_name);
        end loop;
    end $$;

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

    -- Eliminar tablas de clases en vivo y sesiones de estudio
    drop table if exists public.live_class_comments cascade;
    drop table if exists public.live_class_attendance cascade;
    drop table if exists public.live_classes cascade;
    drop table if exists public.study_session_participants cascade;
    drop table if exists public.study_sessions cascade;

    -- Eliminar tablas de comunicación y discusiones
    drop table if exists public.direct_messages cascade;
    drop table if exists public.course_discussions cascade;

    -- Eliminar tablas de grupos y revisiones entre pares
    drop table if exists public.peer_reviews cascade;
    drop table if exists public.task_group_members cascade;
    drop table if exists public.task_groups cascade;
    drop table if exists public.task_progress cascade;

    -- Eliminar tablas de métricas y análisis
    drop table if exists public.student_engagement_metrics cascade;
    drop table if exists public.learning_patterns cascade;
    drop table if exists public.academic_risk_alerts cascade;
    drop table if exists public.progress_reports cascade;

    -- Eliminar tablas de logros y puntos
    drop table if exists public.student_achievements cascade;
    drop table if exists public.achievements cascade;
    drop table if exists public.student_points cascade;

    -- Eliminar tablas de configuración
    drop table if exists public.certificate_templates cascade;
    drop table if exists public.roles cascade;
    drop table if exists public.tenants cascade;
    drop table if exists public.audit_log cascade;
    drop table if exists public.platform_admins cascade;

    -- Eliminar tabla de memberships del modelo multi-tenant
    drop table if exists public.memberships cascade;

    -- =============================================
    -- ELIMINAR EXTENSIONES PERSONALIZADAS
    -- =============================================

    -- Nota: pgcrypto se mantiene porque es requerida por el sistema
    -- y sus funciones son utilizadas por Supabase internamente
    -- drop extension if exists pgcrypto cascade;

    -- =============================================
    -- ELIMINAR ÍNDICES, SECUENCIAS Y TIPOS PERSONALIZADOS
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

    -- Eliminar secuencias personalizadas
    do $$
    declare
        r record;
    begin
        for r in (
            select sequence_name
            from information_schema.sequences
            where sequence_schema = 'public'
        ) loop
            execute format('drop sequence if exists public.%I cascade', r.sequence_name);
        end loop;
    end $$;

    -- Eliminar tipos de datos personalizados
    do $$
    declare
        r record;
    begin
        for r in (
            select typname
            from pg_type t
            join pg_namespace n on n.oid = t.typnamespace
            where n.nspname = 'public'
            and t.typtype = 'e' -- solo enums
        ) loop
            execute format('drop type if exists public.%I cascade', r.typname);
        end loop;
    end $$;

    -- =============================================
    -- LIMPIAR DATOS DE AUTH Y SISTEMA
    -- =============================================

    -- ADVERTENCIA: Esto eliminará todos los usuarios y datos del sistema
    -- Descomenta las siguientes líneas solo si quieres un reset COMPLETO

    -- Eliminar sesiones y tokens activos
    delete from auth.sessions;
    delete from auth.refresh_tokens;
    delete from auth.mfa_factors;
    delete from auth.mfa_challenges;
    delete from auth.mfa_amr_claims;
    delete from auth.sso_providers;
    delete from auth.sso_domains;
    delete from auth.saml_providers;
    delete from auth.saml_relay_states;
    delete from auth.flow_state;
    delete from auth.identities;

    -- Eliminar usuarios (descomenta si quieres eliminar usuarios)
    -- delete from auth.users;

    -- Limpiar datos del sistema de realtime (solo si existen)
    do $$
    begin
        -- Eliminar datos de realtime solo si las tablas existen
        if exists (select 1 from information_schema.tables where table_schema = 'realtime' and table_name = 'messages') then
            delete from realtime.messages;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'realtime' and table_name = 'presence') then
            delete from realtime.presence;
        end if;
        if exists (select 1 from information_schema.tables where table_schema = 'realtime' and table_name = 'channels') then
            delete from realtime.channels;
        end if;
    end $$;

    -- Limpiar logs del sistema (opcional - descomenta si necesitas limpiar logs)
    -- do $$
    -- begin
    --     if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'audit_log_entries') then
    --         truncate table auth.audit_log_entries;
    --     end if;
    --     if exists (select 1 from information_schema.tables where table_schema = 'supabase_functions' and table_name = 'hooks') then
    --         truncate table supabase_functions.hooks;
    --     end if;
    --     if exists (select 1 from information_schema.tables where table_schema = 'supabase_functions' and table_name = 'migrations') then
    --         truncate table supabase_functions.migrations;
    --     end if;
    -- end $$;

    -- =============================================
    -- RESTAURAR CONFIGURACIÓN
    -- =============================================

    -- Restaurar session_replication_role
    set session_replication_role = default;

    -- Confirmar cambios
    commit;

    -- =============================================
    -- VERIFICACIÓN DE LIMPIEZA COMPLETA
    -- =============================================

    -- Mostrar tablas restantes en public
    select 'TABLAS RESTANTES EN PUBLIC:' as info;
    select tablename from pg_tables where schemaname = 'public';

    -- Mostrar vistas restantes en public
    select 'VISTAS RESTANTES EN PUBLIC:' as info;
    select table_name from information_schema.views where table_schema = 'public';

    -- Mostrar funciones restantes en public
    select 'FUNCIONES RESTANTES EN PUBLIC:' as info;
    select routine_name from information_schema.routines 
    where routine_schema = 'public' and routine_type = 'FUNCTION';

    -- Mostrar tipos personalizados restantes
    select 'TIPOS PERSONALIZADOS RESTANTES:' as info;
    select t.typname from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e';

    -- Mostrar secuencias restantes
    select 'SECUENCIAS RESTANTES:' as info;
    select sequence_name from information_schema.sequences where sequence_schema = 'public';

    -- Mostrar buckets restantes
    select 'BUCKETS DE STORAGE RESTANTES:' as info;
    select id, name, public from storage.buckets;

    -- Mostrar políticas de storage restantes
    select 'POLÍTICAS DE STORAGE RESTANTES:' as info;
    select policyname from pg_policies where schemaname = 'storage';

    -- Mostrar objetos de storage restantes
    select 'OBJETOS DE STORAGE RESTANTES:' as info;
    select bucket_id, count(*) as total_objects from storage.objects group by bucket_id;

    -- Mostrar usuarios restantes (solo conteo por seguridad)
    select 'USUARIOS RESTANTES:' as info;
    select count(*) as total_users from auth.users;

    -- Mostrar sesiones activas restantes
    select 'SESIONES ACTIVAS RESTANTES:' as info;
    select count(*) as total_sessions from auth.sessions;

    select '🎉 ¡LIMPIEZA COMPLETA FINALIZADA! 🎉' as resultado;
    select 'Si ves elementos restantes arriba, revisa si son necesarios o si deben eliminarse manualmente.' as nota;