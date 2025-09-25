-- =============================================
-- 002_update.sql
-- Mantenimiento: triggers updated_at, auditoría y sincronización de platform_admins con roles
-- =============================================

begin;

-- =============================================
-- Función genérica para updated_at
-- =============================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

-- =============================================
-- Triggers updated_at (idempotentes)
-- =============================================
-- Tenants
drop trigger if exists trg_tenants_updated_at on public.tenants;
create trigger trg_tenants_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

-- Profiles
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Categories
drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

-- Courses
drop trigger if exists trg_courses_updated_at on public.courses;
create trigger trg_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

-- Resources
drop trigger if exists trg_resources_updated_at on public.resources;
create trigger trg_resources_updated_at
before update on public.resources
for each row execute function public.set_updated_at();

-- Memberships
drop trigger if exists trg_memberships_updated_at on public.memberships;
create trigger trg_memberships_updated_at
before update on public.memberships
for each row execute function public.set_updated_at();

-- Tasks
drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- Evaluations
drop trigger if exists trg_evaluations_updated_at on public.evaluations;
create trigger trg_evaluations_updated_at
before update on public.evaluations
for each row execute function public.set_updated_at();

-- Grades
drop trigger if exists trg_grades_updated_at on public.grades;
create trigger trg_grades_updated_at
before update on public.grades
for each row execute function public.set_updated_at();

-- Certificates
drop trigger if exists trg_certificates_updated_at on public.certificates;
create trigger trg_certificates_updated_at
before update on public.certificates
for each row execute function public.set_updated_at();

-- =============================================
-- Sincronizar platform_admins con profiles.role
-- =============================================
create or replace function public.sync_platform_admins()
returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.role = 'super_admin' then
      insert into public.platform_admins (user_id) values (new.id)
      on conflict (user_id) do nothing;
    else
      delete from public.platform_admins where user_id = new.id;
    end if;
  elsif tg_op = 'DELETE' then
    delete from public.platform_admins where user_id = old.id;
  end if;
  return coalesce(new, old);
end; $$;

drop trigger if exists trg_profiles_sync_pa on public.profiles;
create trigger trg_profiles_sync_pa
after insert or update or delete on public.profiles
for each row execute function public.sync_platform_admins();

-- =============================================
-- Función para crear notificaciones automáticas
-- =============================================
create or replace function public.create_notification()
returns trigger language plpgsql security definer as $$
begin
  -- Notificación cuando se asigna una nueva tarea
  if TG_TABLE_NAME = 'tasks' and TG_OP = 'INSERT' then
    insert into public.notifications (tenant_id, user_id, title, message, type)
    select e.tenant_id, e.student_id, 'Nueva tarea asignada', 'Nueva tarea: ' || NEW.title, 'academic'
    from public.enrollments e
    where e.course_id = NEW.course_id and e.status = 'active';
  end if;

  -- Notificación cuando se califica una entrega (suponiendo que grades se actualiza después de evaluar)
  if TG_TABLE_NAME = 'grades' and TG_OP = 'INSERT' then
    insert into public.notifications (tenant_id, user_id, title, message, type)
    values (NEW.tenant_id, NEW.student_id, 'Tarea calificada', 'Se registró una calificación', 'academic');
  end if;

  return coalesce(NEW, OLD);
end;
$$;

-- Triggers para notificaciones automáticas
drop trigger if exists tasks_notification_trigger on public.tasks;
create trigger tasks_notification_trigger
  after insert on public.tasks
  for each row execute function public.create_notification();

drop trigger if exists grades_notification_trigger on public.grades;
create trigger grades_notification_trigger
  after insert on public.grades
  for each row execute function public.create_notification();

-- =============================================
-- Auditoría (Audit Log)
-- =============================================
create or replace function public.audit_trigger()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (user_id, action, table_name, record_id, new_values)
    values (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id::text, to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.audit_log (user_id, action, table_name, record_id, old_values, new_values)
    values (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id::text, to_jsonb(OLD), to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.audit_log (user_id, action, table_name, record_id, old_values)
    values (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id::text, to_jsonb(OLD));
    return OLD;
  end if;
  return null;
end;
$$;

-- Triggers de auditoría para tablas críticas
drop trigger if exists audit_courses on public.courses;
create trigger audit_courses
  after insert or update or delete on public.courses
  for each row execute function public.audit_trigger();

drop trigger if exists audit_enrollments on public.enrollments;
create trigger audit_enrollments
  after insert or update or delete on public.enrollments
  for each row execute function public.audit_trigger();

drop trigger if exists audit_grades on public.grades;
create trigger audit_grades
  after insert or update or delete on public.grades
  for each row execute function public.audit_trigger();

-- =============================================
-- FUNCIONES RPC PARA EVALUACIONES
-- =============================================

-- Función para obtener evaluación completa con preguntas
DROP FUNCTION IF EXISTS get_evaluation_with_questions(uuid, uuid);
create or replace function get_evaluation_with_questions(
  p_evaluation_id uuid default null,
  p_student_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  evaluation_data jsonb;
  questions_data jsonb;
begin
  -- Obtener datos de la evaluación
  select to_jsonb(e.*) into evaluation_data
  from public.evaluations e
  where e.id = p_evaluation_id;
  
  if evaluation_data is null then
    return null;
  end if;
  
  -- Obtener preguntas (sin respuestas correctas si es estudiante)
  if p_student_id is not null then
    -- Vista para estudiante (sin respuestas correctas)
    select jsonb_agg(
      jsonb_build_object(
        'id', eq.id,
        'question_text', eq.question_text,
        'question_type', eq.question_type,
        'options', eq.options,
        'points', eq.points,
        'order_index', eq.order_index,
        'is_required', eq.is_required
      ) order by eq.order_index
    ) into questions_data
    from public.evaluation_questions eq
    where eq.evaluation_id = p_evaluation_id;
  else
    -- Vista para profesor (con respuestas correctas)
    select jsonb_agg(
      to_jsonb(eq.*) order by eq.order_index
    ) into questions_data
    from public.evaluation_questions eq
    where eq.evaluation_id = p_evaluation_id;
  end if;
  
  -- Combinar evaluación con preguntas
  return evaluation_data || jsonb_build_object('questions', coalesce(questions_data, '[]'::jsonb));
end;
$$;

-- Función para iniciar intento de evaluación
DROP FUNCTION IF EXISTS start_evaluation_attempt(uuid, uuid);
create or replace function start_evaluation_attempt(
  p_evaluation_id uuid,
  p_student_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  attempt_id uuid;
  current_attempts integer;
  max_attempts integer;
begin
  -- Verificar límite de intentos
  select max_attempts into max_attempts
  from public.evaluations
  where id = p_evaluation_id;
  
  select count(*) into current_attempts
  from public.evaluation_attempts
  where evaluation_id = p_evaluation_id and student_id = p_student_id;
  
  if current_attempts >= max_attempts then
    raise exception 'Maximum attempts exceeded';
  end if;
  
  -- Crear nuevo intento
  insert into public.evaluation_attempts (
    evaluation_id,
    student_id,
    attempt_number
  ) values (
    p_evaluation_id,
    p_student_id,
    current_attempts + 1
  ) returning id into attempt_id;
  
  return attempt_id;
end;
$$;

-- Función para calificar automáticamente
DROP FUNCTION IF EXISTS auto_grade_evaluation(uuid);
create or replace function auto_grade_evaluation(
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  total_score numeric(5,2) := 0;
  max_score numeric(5,2) := 0;
  percentage numeric(5,2);
  result jsonb;
begin
  -- Calificar respuestas automáticamente
  update public.student_answers sa
  set 
    is_correct = case 
      when eq.question_type in ('multiple_choice', 'true_false') then
        sa.answer_text = eq.correct_answer
      else null -- Essay questions need manual grading
    end,
    points_earned = case 
      when eq.question_type in ('multiple_choice', 'true_false') and sa.answer_text = eq.correct_answer then
        eq.points
      when eq.question_type in ('multiple_choice', 'true_false') then
        0
      else null -- Essay questions need manual grading
    end
  from public.evaluation_questions eq,
       public.evaluation_attempts ea
  where sa.question_id = eq.id
    and sa.evaluation_id = ea.evaluation_id
    and ea.id = p_attempt_id;
  
  -- Calcular puntajes
  select 
    coalesce(sum(sa.points_earned), 0),
    sum(eq.points)
  into total_score, max_score
  from public.evaluation_attempts ea
  join public.student_answers sa on sa.evaluation_id = ea.evaluation_id and sa.student_id = ea.student_id
  join public.evaluation_questions eq on eq.id = sa.question_id
  where ea.id = p_attempt_id
    and sa.points_earned is not null; -- Solo contar preguntas ya calificadas
  
  -- Calcular porcentaje
  percentage := case when max_score > 0 then (total_score / max_score) * 100 else 0 end;
  
  -- Actualizar intento
  update public.evaluation_attempts
  set 
    total_score = total_score,
    max_possible_score = max_score,
    percentage = percentage,
    status = 'graded',
    submitted_at = now()
  where id = p_attempt_id;
  
  return jsonb_build_object(
    'total_score', total_score,
    'max_score', max_score,
    'percentage', percentage
  );
end;
$$;

-- =============================================
-- FUNCIONES RPC PARA NOTIFICACIONES
-- =============================================

-- Crear notificación
DROP FUNCTION IF EXISTS create_notification(uuid, uuid, text, text, text);
create or replace function create_notification(
  p_tenant_id uuid,
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text default 'info'
)
returns uuid
language plpgsql
security definer
as $$
declare
  notification_id uuid;
begin
  insert into public.notifications (
    tenant_id,
    user_id,
    title,
    message,
    type
  ) values (
    p_tenant_id,
    p_user_id,
    p_title,
    p_message,
    p_type
  ) returning id into notification_id;
  
  return notification_id;
end;
$$;

-- Listar notificaciones por usuario
DROP FUNCTION IF EXISTS get_user_notifications(uuid, uuid, boolean, text, integer, integer);
create or replace function get_user_notifications(
  p_user_id uuid,
  p_tenant_id uuid default null,
  p_is_read boolean default null,
  p_type text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  tenant_id uuid,
  user_id uuid,
  title text,
  message text,
  type text,
  is_read boolean,
  created_at timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    n.id,
    n.tenant_id,
    n.user_id,
    n.title,
    n.message,
    n.type,
    n.is_read,
    n.created_at
  from public.notifications n
  where n.user_id = p_user_id
    and (p_tenant_id is null or n.tenant_id = p_tenant_id)
    and (p_is_read is null or n.is_read = p_is_read)
    and (p_type is null or n.type = p_type)
  order by n.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

-- Marcar notificación como leída
DROP FUNCTION IF EXISTS mark_notification_read(uuid, uuid);
create or replace function mark_notification_read(
  p_notification_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  updated_count integer;
begin
  update public.notifications
  set is_read = true
  where id = p_notification_id
    and user_id = p_user_id;
  
  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

-- =============================================
-- FUNCIONES RPC PARA CERTIFICADOS
-- =============================================

-- Emitir certificado
DROP FUNCTION IF EXISTS issue_certificate(uuid, uuid, uuid, jsonb, text, uuid);
create or replace function issue_certificate(
  p_tenant_id uuid,
  p_student_id uuid,
  p_course_id uuid,
  p_template jsonb,
  p_qr_code text,
  p_signed_by uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  certificate_id uuid;
begin
  -- Verificar que el estudiante esté inscrito en el curso
  if not exists (
    select 1 from public.enrollments
    where student_id = p_student_id
      and course_id = p_course_id
      and status = 'completed'
  ) then
    raise exception 'El estudiante debe completar el curso antes de recibir el certificado';
  end if;
  
  -- Verificar que no exista ya un certificado para este estudiante y curso
  if exists (
    select 1 from public.certificates
    where student_id = p_student_id
      and course_id = p_course_id
  ) then
    raise exception 'Ya existe un certificado para este estudiante y curso';
  end if;
  
  insert into public.certificates (
    tenant_id,
    student_id,
    course_id,
    template,
    qr_code,
    signed_by
  ) values (
    p_tenant_id,
    p_student_id,
    p_course_id,
    p_template,
    p_qr_code,
    p_signed_by
  ) returning id into certificate_id;
  
  return certificate_id;
end;
$$;

-- Obtener templates de certificados
drop function if exists get_certificate_templates(uuid, boolean, integer, integer);
create or replace function get_certificate_templates(
  p_tenant_id uuid default null,
  p_is_active boolean default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  tenant_id uuid,
  name text,
  description text,
  template_data jsonb,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    ct.id,
    ct.tenant_id,
    ct.name,
    ct.description,
    ct.template_data,
    ct.is_active,
    ct.created_at,
    ct.updated_at
  from public.certificate_templates ct
  where (p_tenant_id is null or ct.tenant_id = p_tenant_id)
    and (p_is_active is null or ct.is_active = p_is_active)
  order by ct.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

-- =============================================
-- FUNCIONES RPC PARA ADMINISTRACIÓN
-- =============================================

-- Helpers de roles
create or replace function public.get_role(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = p_user
$$;

create or replace function public.is_platform_admin(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.platform_admins pa where pa.user_id = p_user
    union
    select 1 from public.profiles p where p.id = p_user and p.role = 'super_admin'
    union
    select 1 from public.memberships m where m.user_id = p_user and m.role in ('admin','owner') and m.is_active = true
  )
$$;

create or replace function public.has_role(p_role_name text, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.profiles p where p.id = p_user and p.role = p_role_name
    union
    select 1 from public.memberships m where m.user_id = p_user and m.role = p_role_name and m.is_active = true
  )
$$;

-- Gestión de roles (usando profiles y memberships)
create or replace function public.update_user_role(p_user_id uuid, p_role_name text default 'student', p_tenant_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tenant_id is null then
    -- Actualizar rol global en profiles
    update public.profiles
    set role = trim(p_role_name)
    where id = p_user_id;
    return found;
  else
    -- Actualizar rol por tenant en memberships
    update public.memberships
    set role = trim(p_role_name)
    where user_id = p_user_id and tenant_id = p_tenant_id;
    return found;
  end if;
end; $$;

-- Asignación de roles a usuarios (compatibilidad)
create or replace function public.user_role_assign(p_user uuid, p_role_name text default 'student', p_tenant_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.update_user_role(p_user, p_role_name, p_tenant_id) then
    raise exception 'No se pudo asignar el rol % al usuario', p_role_name using errcode = 'P0001';
  end if;
end; $$;

-- =============================================
-- FUNCIONES PARA GESTIÓN DE MEMBERSHIPS
-- =============================================

-- Crear o actualizar membership
create or replace function public.create_membership(
  p_user_id uuid,
  p_tenant_id uuid,
  p_role text default 'student',
  p_permissions jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership_id uuid;
begin
  insert into public.memberships (user_id, tenant_id, role, permissions)
  values (p_user_id, p_tenant_id, p_role, p_permissions)
  on conflict (user_id, tenant_id) 
  do update set 
    role = excluded.role,
    permissions = excluded.permissions,
    is_active = true,
    updated_at = now()
  returning id into v_membership_id;
  
  return v_membership_id;
end; $$;

-- Revocar rol de usuario
create or replace function public.user_role_revoke(p_user uuid, p_role_name text, p_tenant_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tenant_id is null then
    -- Actualizar rol global en profiles
    update public.profiles 
    set role = 'student', updated_at = now()
    where id = p_user and role = p_role_name;
  else
    -- Remover membership específica del tenant
    update public.memberships 
    set is_active = false, updated_at = now()
    where user_id = p_user and tenant_id = p_tenant_id and role = p_role_name;
  end if;
end; $$;

-- Listar roles de usuario
drop function if exists public.user_roles_list(uuid);
create or replace function public.user_roles_list(p_user uuid)
returns table(role_name text, tenant_id uuid, tenant_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select distinct
    roles.role_name,
    roles.tenant_id,
    roles.tenant_name
  from (
    select 
      p.role as role_name,
      null::uuid as tenant_id,
      'Global'::text as tenant_name
    from public.profiles p
    where p.id = p_user and p.role is not null
    
    union all
    
    select 
      m.role as role_name,
      m.tenant_id,
      t.name as tenant_name
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.user_id = p_user and m.is_active = true
  ) as roles;
end; $$;

-- Obtener memberships de un usuario
drop function if exists public.get_user_memberships(uuid);
create or replace function public.get_user_memberships(p_user_id uuid)
returns table (
  membership_id uuid,
  tenant_id uuid,
  tenant_name text,
  role text,
  permissions jsonb,
  is_active boolean,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    m.id,
    m.tenant_id,
    t.name,
    m.role,
    m.permissions,
    m.is_active,
    m.joined_at
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = p_user_id
    and m.is_active = true
  order by m.joined_at desc;
end; $$;

-- Desactivar membership
create or replace function public.deactivate_membership(
  p_user_id uuid,
  p_tenant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.memberships
  set is_active = false, updated_at = now()
  where user_id = p_user_id and tenant_id = p_tenant_id;
  
  return found;
end; $$;

-- =============================================
-- FUNCIÓN PARA CREAR USUARIOS DESDE ADMIN
-- =============================================

-- Función para crear usuarios desde el panel de administración
-- Esta función solo actualiza el perfil después de que el usuario sea creado en auth.users
DROP FUNCTION IF EXISTS public.create_user_admin(text,text,text,text,text,text,text);
CREATE OR REPLACE FUNCTION public.create_user_admin(
  p_email text,
  p_password text,
  p_full_name text DEFAULT NULL,
  p_role_name text DEFAULT 'student',
  p_phone text DEFAULT NULL,
  p_signature_url text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_existing_user uuid;
BEGIN
  -- Validar que el usuario actual sea admin
  IF NOT public.is_platform_admin(auth.uid()) AND NOT public.has_role('super_admin', auth.uid()) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solo administradores pueden crear usuarios'
    );
  END IF;

  -- Validaciones
  IF p_email IS NULL OR p_email = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Email es requerido'
    );
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Password debe tener al menos 6 caracteres'
    );
  END IF;

  -- Validar rol
  IF p_role_name NOT IN ('student', 'teacher', 'super_admin', 'tenant_admin', 'parent') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rol no válido: ' || p_role_name
    );
  END IF;

  -- Obtener tenant del admin actual
  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se pudo determinar el tenant'
    );
  END IF;

  -- Verificar si el usuario ya existe
  SELECT id INTO v_existing_user FROM auth.users WHERE email = p_email;
  IF v_existing_user IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ya existe un usuario con este email'
    );
  END IF;

  -- Esta función valida los datos y retorna la configuración para crear el usuario
  -- El frontend usará supabase.auth.signUp() con estos datos validados
  RETURN jsonb_build_object(
    'success', true,
    'validated_data', jsonb_build_object(
      'email', lower(trim(p_email)),
      'full_name', coalesce(p_full_name, split_part(p_email, '@', 1)),
      'role', p_role_name,
      'phone', p_phone,
      'signature_url', p_signature_url,
      'avatar_url', p_avatar_url,
      'tenant_id', v_tenant_id
    ),
    'message', 'Datos validados correctamente. Proceder con signUp.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error al crear usuario: ' || SQLERRM
    );
END;
$$;

-- Listar roles disponibles (basado en memberships)
drop function if exists public.list_available_roles() cascade;
create or replace function public.list_available_roles()
returns table(role_name text, description text, usage_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  table_exists boolean;
begin
  -- Verificar si la tabla memberships existe
  select exists (
    select from information_schema.tables 
    where table_schema = 'public' 
    and table_name = 'memberships'
  ) into table_exists;
  
  if table_exists then
    return query
    select 
      r.role_name,
      case r.role_name
        when 'owner' then 'Propietario del tenant'
        when 'admin' then 'Administrador del tenant'
        when 'teacher' then 'Profesor'
        when 'student' then 'Estudiante'
        when 'parent' then 'Padre/Tutor'
        when 'viewer' then 'Observador'
      end as description,
      count(m.id)::bigint as usage_count
    from unnest(array['owner', 'admin', 'teacher', 'student', 'parent', 'viewer']) with ordinality as r(role_name, ord)
    left join public.memberships m
      on m.role = r.role_name
     and m.is_active = true
    group by r.role_name, r.ord
    order by r.ord;
  else
    -- Si la tabla no existe, devolver solo los roles básicos sin conteo
    return query
    select 
      r.role_name,
      case r.role_name
        when 'owner' then 'Propietario del tenant'
        when 'admin' then 'Administrador del tenant'
        when 'teacher' then 'Profesor'
        when 'student' then 'Estudiante'
        when 'parent' then 'Padre/Tutor'
        when 'viewer' then 'Observador'
      end as description,
      0::bigint as usage_count
    from unnest(array['owner', 'admin', 'teacher', 'student', 'parent', 'viewer']) with ordinality as r(role_name, ord)
    order by r.ord;
  end if;
end;
$$;

-- Obtener estadísticas de roles
create or replace function public.get_role_statistics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_object_agg(role, count)
  into v_result
  from (
    select role, count(*) as count
    from public.memberships
    where is_active = true
    group by role
  ) stats;
  
  return coalesce(v_result, '{}');
end;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.create_user_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_role(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role_assign(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role_revoke(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_membership(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_roles_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_memberships(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_membership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_available_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.role_create_membership(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.role_delete_membership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_role_statistics() TO authenticated;

-- =============================================
-- FUNCIONES RPC AVANZADAS - NEPTUNO 2025
-- =============================================

-- =============================================
-- FUNCIONES PARA CLASES EN VIVO
-- =============================================

-- Crear clase en vivo
create or replace function create_live_class(
  p_tenant_id uuid,
  p_course_id uuid,
  p_instructor_id uuid,
  p_title text,
  p_description text default null,
  p_scheduled_start timestamptz default null,
  p_scheduled_end timestamptz default null,
  p_meeting_url text default null,
  p_meeting_id text default null,
  p_meeting_password text default null,
  p_max_participants integer default 100,
  p_is_recorded boolean default true,
  p_attendance_required boolean default false
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_live_class_id uuid;
begin
  -- Validar que el instructor pertenezca al curso
  if not exists (
    select 1 from public.courses c
    where c.id = p_course_id
      and c.instructor_id = p_instructor_id
      and c.tenant_id = p_tenant_id
  ) then
    raise exception 'El instructor no está asignado a este curso';
  end if;

  -- Crear la clase en vivo
  insert into public.live_classes (
    tenant_id, course_id, instructor_id, title, description,
    scheduled_start, scheduled_end, meeting_url, meeting_id,
    meeting_password, max_participants, is_recorded, attendance_required
  ) values (
    p_tenant_id, p_course_id, p_instructor_id, p_title, p_description,
    p_scheduled_start, p_scheduled_end, p_meeting_url, p_meeting_id,
    p_meeting_password, p_max_participants, p_is_recorded, p_attendance_required
  ) returning id into v_live_class_id;

  -- Crear notificaciones para estudiantes inscritos
  insert into public.notifications (tenant_id, user_id, title, message, type)
  select 
    p_tenant_id,
    e.student_id,
    'Nueva clase en vivo programada',
    'Clase: ' || p_title || ' - ' || to_char(p_scheduled_start, 'DD/MM/YYYY HH24:MI'),
    'academic'
  from public.enrollments e
  where e.course_id = p_course_id
    and e.status = 'active';

  return v_live_class_id;
end;
$$;

-- Iniciar clase en vivo
DROP FUNCTION IF EXISTS start_live_class(uuid, uuid);
create or replace function start_live_class(
  p_live_class_id uuid,
  p_instructor_id uuid
)
returns boolean
language plpgsql
security definer
as $$
begin
  -- Verificar que el instructor sea el correcto
  if not exists (
    select 1 from public.live_classes lc
    where lc.id = p_live_class_id
      and lc.instructor_id = p_instructor_id
  ) then
    raise exception 'No autorizado para iniciar esta clase';
  end if;

  -- Actualizar estado y tiempo de inicio
  update public.live_classes
  set 
    status = 'live',
    actual_start = now()
  where id = p_live_class_id;

  return found;
end;
$$;

-- Registrar asistencia a clase en vivo
create or replace function join_live_class(
  p_live_class_id uuid,
  p_student_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_attendance_id uuid;
begin
  -- Verificar que el estudiante esté inscrito en el curso
  if not exists (
    select 1 from public.live_classes lc
    join public.enrollments e on e.course_id = lc.course_id
    where lc.id = p_live_class_id
      and e.student_id = p_student_id
      and e.status = 'active'
  ) then
    raise exception 'Estudiante no inscrito en el curso';
  end if;

  -- Registrar asistencia
  insert into public.live_class_attendance (
    live_class_id, student_id, joined_at
  ) values (
    p_live_class_id, p_student_id, now()
  ) 
  on conflict (live_class_id, student_id)
  do update set joined_at = now()
  returning id into v_attendance_id;

  return v_attendance_id;
end;
$$;

-- Finalizar asistencia a clase
create or replace function leave_live_class(
  p_live_class_id uuid,
  p_student_id uuid
)
returns boolean
language plpgsql
security definer
as $$
begin
  update public.live_class_attendance
  set 
    left_at = now(),
    duration_minutes = extract(epoch from (now() - joined_at)) / 60
  where live_class_id = p_live_class_id
    and student_id = p_student_id
    and left_at is null;

  return found;
end;
$$;

-- =============================================
-- FUNCIONES PARA COMENTARIOS Y CHAT
-- =============================================

-- Agregar comentario en clase en vivo
DROP FUNCTION IF EXISTS add_live_class_comment(uuid, uuid, text, text, uuid);
create or replace function add_live_class_comment(
  p_live_class_id uuid,
  p_user_id uuid,
  p_content text,
  p_comment_type text default 'comment',
  p_parent_comment_id uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_comment_id uuid;
begin
  -- Verificar que el usuario tenga acceso a la clase
  if not exists (
    select 1 from public.live_classes lc
    join public.enrollments e on e.course_id = lc.course_id
    where lc.id = p_live_class_id
      and (e.student_id = p_user_id or lc.instructor_id = p_user_id)
  ) then
    raise exception 'No autorizado para comentar en esta clase';
  end if;

  insert into public.live_class_comments (
    live_class_id, user_id, parent_comment_id, content, comment_type
  ) values (
    p_live_class_id, p_user_id, p_parent_comment_id, p_content, p_comment_type
  ) returning id into v_comment_id;

  return v_comment_id;
end;
$$;

-- Reaccionar a comentario
create or replace function react_to_comment(
  p_comment_id uuid,
  p_user_id uuid,
  p_reaction_type text -- 'like', 'love', 'helpful', etc.
)
returns boolean
language plpgsql
security definer
as $$
declare
  current_reactions jsonb;
  reaction_count integer;
begin
  -- Obtener reacciones actuales
  select reactions into current_reactions
  from public.live_class_comments
  where id = p_comment_id;

  -- Obtener conteo actual de esta reacción
  reaction_count := coalesce((current_reactions->>p_reaction_type)::integer, 0);

  -- Incrementar contador
  current_reactions := jsonb_set(
    coalesce(current_reactions, '{}'),
    array[p_reaction_type],
    to_jsonb(reaction_count + 1)
  );

  -- Actualizar comentario
  update public.live_class_comments
  set reactions = current_reactions
  where id = p_comment_id;

  return found;
end;
$$;

-- Crear discusión en curso
DROP FUNCTION IF EXISTS create_course_discussion(uuid, uuid, uuid, text, text, text, text[]);
create or replace function create_course_discussion(
  p_tenant_id uuid,
  p_course_id uuid,
  p_user_id uuid,
  p_title text,
  p_content text,
  p_discussion_type text default 'general',
  p_tags text[] default '{}'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_discussion_id uuid;
begin
  -- Verificar acceso al curso
  if not exists (
    select 1 from public.enrollments e
    where e.course_id = p_course_id
      and e.student_id = p_user_id
      and e.status = 'active'
  ) and not exists (
    select 1 from public.courses c
    where c.id = p_course_id
      and c.instructor_id = p_user_id
  ) then
    raise exception 'No autorizado para crear discusiones en este curso';
  end if;

  insert into public.course_discussions (
    tenant_id, course_id, user_id, title, content, discussion_type, tags
  ) values (
    p_tenant_id, p_course_id, p_user_id, p_title, p_content, p_discussion_type, p_tags
  ) returning id into v_discussion_id;

  return v_discussion_id;
end;
$$;

-- Enviar mensaje directo
DROP FUNCTION IF EXISTS send_direct_message(uuid, uuid, uuid, text, text, text, text, integer);
create or replace function send_direct_message(
  p_tenant_id uuid default null,
  p_sender_id uuid default null,
  p_recipient_id uuid default null,
  p_content text default null,
  p_message_type text default 'text',
  p_file_url text default null,
  p_file_name text default null,
  p_file_size integer default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_message_id uuid;
begin
  -- Verificar que ambos usuarios pertenezcan al mismo tenant
  if not exists (
    select 1 from public.memberships m1
    join public.memberships m2 on m1.tenant_id = m2.tenant_id
    where m1.user_id = p_sender_id
      and m2.user_id = p_recipient_id
      and m1.tenant_id = p_tenant_id
      and m1.is_active = true
      and m2.is_active = true
  ) then
    raise exception 'Los usuarios no pertenecen al mismo tenant';
  end if;

  insert into public.direct_messages (
    tenant_id, sender_id, recipient_id, content, message_type,
    file_url, file_name, file_size
  ) values (
    p_tenant_id, p_sender_id, p_recipient_id, p_content, p_message_type,
    p_file_url, p_file_name, p_file_size
  ) returning id into v_message_id;

  -- Crear notificación para el destinatario
  insert into public.notifications (tenant_id, user_id, title, message, type)
  values (
    p_tenant_id,
    p_recipient_id,
    'Nuevo mensaje directo',
    'Tienes un nuevo mensaje de ' || (select full_name from public.profiles where id = p_sender_id),
    'info'
  );

  return v_message_id;
end;
$$;

-- =============================================
-- FUNCIONES PARA TAREAS AVANZADAS
-- =============================================

-- Crear tarea con configuración avanzada
DROP FUNCTION IF EXISTS create_advanced_task(uuid, uuid, text, text, text, timestamptz, numeric, jsonb, jsonb, boolean, numeric, boolean, integer, text, integer, text, text[], jsonb);
create or replace function create_advanced_task(
  p_tenant_id uuid default null,
  p_course_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_task_type text default 'assignment',
  p_due_date timestamptz default null,
  p_max_score numeric default 100,
  p_instructions jsonb default '{}',
  p_rubric jsonb default '{}',
  p_allow_late_submission boolean default true,
  p_late_penalty_percent numeric default 10.00,
  p_group_task boolean default false,
  p_max_group_size integer default 1,
  p_submission_format text default 'text',
  p_estimated_duration_minutes integer default 60,
  p_difficulty_level text default 'intermediate',
  p_learning_objectives text[] default '{}',
  p_resources jsonb default '[]'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_task_id uuid;
begin
  -- Verificar que el usuario sea instructor del curso
  if not exists (
    select 1 from public.courses c
    where c.id = p_course_id
      and c.instructor_id = auth.uid()
      and c.tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para crear tareas en este curso';
  end if;

  insert into public.tasks (
    tenant_id, course_id, title, description, task_type, due_date,
    max_score, instructions, rubric, allow_late_submission,
    late_penalty_percent, group_task, max_group_size, submission_format,
    estimated_duration_minutes, difficulty_level, learning_objectives, resources
  ) values (
    p_tenant_id, p_course_id, p_title, p_description, p_task_type, p_due_date,
    p_max_score, p_instructions, p_rubric, p_allow_late_submission,
    p_late_penalty_percent, p_group_task, p_max_group_size, p_submission_format,
    p_estimated_duration_minutes, p_difficulty_level, p_learning_objectives, p_resources
  ) returning id into v_task_id;

  -- Crear registros de progreso para todos los estudiantes inscritos
  insert into public.task_progress (task_id, student_id)
  select v_task_id, e.student_id
  from public.enrollments e
  where e.course_id = p_course_id
    and e.status = 'active';

  return v_task_id;
end;
$$;

-- Actualizar progreso de tarea
DROP FUNCTION IF EXISTS update_task_progress(uuid, uuid, text, numeric, integer, text, text[]);
create or replace function update_task_progress(
  p_task_id uuid default null,
  p_student_id uuid default null,
  p_status text default null,
  p_progress_percentage numeric default null,
  p_time_spent_minutes integer default null,
  p_notes text default null,
  p_milestones_completed text[] default null
)
returns boolean
language plpgsql
security definer
as $$
begin
  update public.task_progress
  set 
    status = coalesce(p_status, status),
    progress_percentage = coalesce(p_progress_percentage, progress_percentage),
    time_spent_minutes = coalesce(p_time_spent_minutes, time_spent_minutes),
    notes = coalesce(p_notes, notes),
    milestones_completed = coalesce(p_milestones_completed, milestones_completed),
    last_activity = now()
  where task_id = p_task_id
    and student_id = p_student_id;

  return found;
end;
$$;

-- Crear grupo para tarea colaborativa
DROP FUNCTION IF EXISTS create_task_group(uuid, text, text, uuid);
create or replace function create_task_group(
  p_task_id uuid default null,
  p_name text default null,
  p_description text default null,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_max_group_size integer;
begin
  -- Verificar que la tarea permita grupos
  select max_group_size into v_max_group_size
  from public.tasks
  where id = p_task_id
    and group_task = true;

  if v_max_group_size is null then
    raise exception 'Esta tarea no permite trabajo en grupo';
  end if;

  insert into public.task_groups (task_id, name, description, max_members, created_by)
  values (p_task_id, p_name, p_description, v_max_group_size, coalesce(p_created_by, auth.uid()))
  returning id into v_group_id;

  -- Agregar al creador como líder del grupo
  if p_created_by is not null then
    insert into public.task_group_members (group_id, student_id, role)
    values (v_group_id, p_created_by, 'leader');
  end if;

  return v_group_id;
end;
$$;

-- =============================================
-- FUNCIONES PARA ANALÍTICAS DE APRENDIZAJE
-- =============================================

-- Actualizar métricas de engagement diarias
DROP FUNCTION IF EXISTS update_daily_engagement(uuid, uuid, text);
create or replace function update_daily_engagement(
  p_student_id uuid default null,
  p_course_id uuid default null,
  p_activity_type text default 'login' -- 'login', 'resource_access', 'assignment_submit', etc.
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
begin
  -- Obtener tenant del estudiante
  select tenant_id into v_tenant_id
  from public.profiles
  where id = p_student_id;

  -- Actualizar o crear registro de engagement para hoy
  insert into public.student_engagement_metrics (
    tenant_id, student_id, course_id, date,
    login_count, resources_accessed, assignments_submitted,
    discussions_participated, live_classes_attended, quiz_attempts
  ) values (
    v_tenant_id, p_student_id, p_course_id, current_date,
    case when p_activity_type = 'login' then 1 else 0 end,
    case when p_activity_type = 'resource_access' then 1 else 0 end,
    case when p_activity_type = 'assignment_submit' then 1 else 0 end,
    case when p_activity_type = 'discussion_participate' then 1 else 0 end,
    case when p_activity_type = 'live_class_attend' then 1 else 0 end,
    case when p_activity_type = 'quiz_attempt' then 1 else 0 end
  )
  on conflict (student_id, course_id, date)
  do update set
    login_count = case when p_activity_type = 'login' then student_engagement_metrics.login_count + 1 else student_engagement_metrics.login_count end,
    resources_accessed = case when p_activity_type = 'resource_access' then student_engagement_metrics.resources_accessed + 1 else student_engagement_metrics.resources_accessed end,
    assignments_submitted = case when p_activity_type = 'assignment_submit' then student_engagement_metrics.assignments_submitted + 1 else student_engagement_metrics.assignments_submitted end,
    discussions_participated = case when p_activity_type = 'discussion_participate' then student_engagement_metrics.discussions_participated + 1 else student_engagement_metrics.discussions_participated end,
    live_classes_attended = case when p_activity_type = 'live_class_attend' then student_engagement_metrics.live_classes_attended + 1 else student_engagement_metrics.live_classes_attended end,
    quiz_attempts = case when p_activity_type = 'quiz_attempt' then student_engagement_metrics.quiz_attempts + 1 else student_engagement_metrics.quiz_attempts end;

  return true;
end;
$$;

-- Generar alerta de riesgo académico
DROP FUNCTION IF EXISTS create_academic_risk_alert(uuid, uuid, text, text, text, text[]);
create or replace function create_academic_risk_alert(
  p_student_id uuid default null,
  p_course_id uuid default null,
  p_risk_type text default null,
  p_risk_level text default 'medium',
  p_description text default null,
  p_suggested_actions text[] default '{}'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_alert_id uuid;
  v_tenant_id uuid;
begin
  -- Obtener tenant
  select tenant_id into v_tenant_id
  from public.profiles
  where id = p_student_id;

  insert into public.academic_risk_alerts (
    tenant_id, student_id, course_id, risk_type, risk_level,
    description, suggested_actions
  ) values (
    v_tenant_id, p_student_id, p_course_id, p_risk_type, p_risk_level,
    p_description, p_suggested_actions
  ) returning id into v_alert_id;

  -- Notificar al instructor y padres
  insert into public.notifications (tenant_id, user_id, title, message, type)
  select 
    v_tenant_id,
    c.instructor_id,
    'Alerta de riesgo académico',
    'Estudiante: ' || p.full_name || ' - ' || p_description,
    'academic'
  from public.courses c
  join public.profiles p on p.id = p_student_id
  where c.id = p_course_id;

  -- Notificar a padres si existen
  insert into public.notifications (tenant_id, user_id, title, message, type)
  select 
    v_tenant_id,
    r.parent_id,
    'Alerta académica de su hijo/a',
    'Su hijo/a ' || p.full_name || ' requiere atención: ' || p_description,
    'academic'
  from public.relationships r
  join public.profiles p on p.id = p_student_id
  where r.student_id = p_student_id;

  return v_alert_id;
end;
$$;

-- =============================================
-- FUNCIONES PARA GAMIFICACIÓN
-- =============================================

-- Otorgar logro a estudiante
DROP FUNCTION IF EXISTS award_achievement(uuid, uuid, uuid);
create or replace function award_achievement(
  p_student_id uuid default null,
  p_achievement_id uuid default null,
  p_course_id uuid default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_points integer;
begin
  -- Obtener puntos del logro
  select points_value into v_points
  from public.achievements
  where id = p_achievement_id
    and is_active = true;

  if v_points is null then
    return false;
  end if;

  -- Otorgar logro (evitar duplicados)
  insert into public.student_achievements (student_id, achievement_id, course_id, points_earned)
  values (p_student_id, p_achievement_id, p_course_id, v_points)
  on conflict (student_id, achievement_id, course_id) do nothing;

  -- Actualizar puntos del estudiante
  insert into public.student_points (tenant_id, student_id, course_id, total_points)
  select 
    p.tenant_id,
    p_student_id,
    p_course_id,
    v_points
  from public.profiles p
  where p.id = p_student_id
  on conflict (student_id, course_id)
  do update set
    total_points = student_points.total_points + v_points,
    updated_at = now();

  return true;
end;
$$;

-- Calcular ranking de estudiantes
create or replace function update_student_rankings()
returns void
language plpgsql
security definer
as $$
begin
  -- Actualizar ranking por curso
  update public.student_points sp1
  set rank_in_course = (
    select count(*) + 1
    from public.student_points sp2
    where sp2.course_id = sp1.course_id
      and sp2.total_points > sp1.total_points
  )
  where sp1.course_id is not null;

  -- Actualizar ranking por tenant
  update public.student_points sp1
  set rank_in_tenant = (
    select count(*) + 1
    from public.student_points sp2
    where sp2.tenant_id = sp1.tenant_id
      and sp2.total_points > sp1.total_points
  );
end;
$$;

-- =============================================
-- FUNCIONES DE REPORTES Y DASHBOARD
-- =============================================

-- Obtener dashboard del instructor
DROP FUNCTION IF EXISTS get_instructor_dashboard(uuid, uuid, date, date);
create or replace function get_instructor_dashboard(
  p_instructor_id uuid default null,
  p_tenant_id uuid default null,
  p_date_from date default current_date - interval '30 days',
  p_date_to date default current_date
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
  v_courses_count integer;
  v_students_count integer;
  v_live_classes_count integer;
  v_pending_grades integer;
  v_risk_alerts integer;
begin
  -- Contar cursos activos
  select count(*) into v_courses_count
  from public.courses
  where instructor_id = p_instructor_id
    and tenant_id = p_tenant_id
    and is_active = true;

  -- Contar estudiantes totales
  select count(distinct e.student_id) into v_students_count
  from public.enrollments e
  join public.courses c on c.id = e.course_id
  where c.instructor_id = p_instructor_id
    and c.tenant_id = p_tenant_id
    and e.status = 'active';

  -- Contar clases en vivo próximas
  select count(*) into v_live_classes_count
  from public.live_classes
  where instructor_id = p_instructor_id
    and tenant_id = p_tenant_id
    and scheduled_start between now() and now() + interval '7 days'
    and status = 'scheduled';

  -- Contar tareas pendientes de calificar
  select count(*) into v_pending_grades
  from public.submissions s
  join public.tasks t on t.id = s.task_id
  join public.courses c on c.id = t.course_id
  where c.instructor_id = p_instructor_id
    and c.tenant_id = p_tenant_id
    and s.graded_at is null;

  -- Contar alertas de riesgo no resueltas
  select count(*) into v_risk_alerts
  from public.academic_risk_alerts ara
  join public.courses c on c.id = ara.course_id
  where c.instructor_id = p_instructor_id
    and c.tenant_id = p_tenant_id
    and ara.is_resolved = false;

  v_result := jsonb_build_object(
    'courses_count', v_courses_count,
    'students_count', v_students_count,
    'upcoming_live_classes', v_live_classes_count,
    'pending_grades', v_pending_grades,
    'risk_alerts', v_risk_alerts,
    'generated_at', now()
  );

  return v_result;
end;
$$;

-- Obtener dashboard del estudiante
create or replace function get_student_dashboard(
  p_student_id uuid default null,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
  v_enrolled_courses integer;
  v_pending_tasks integer;
  v_upcoming_classes integer;
  v_total_points integer;
  v_achievements_count integer;
  v_current_level text;
begin
  -- Contar cursos inscritos
  select count(*) into v_enrolled_courses
  from public.enrollments
  where student_id = p_student_id
    and status = 'active';

  -- Contar tareas pendientes
  select count(*) into v_pending_tasks
  from public.task_progress tp
  join public.tasks t on t.id = tp.task_id
  where tp.student_id = p_student_id
    and tp.status in ('not_started', 'in_progress')
    and t.due_date > now();

  -- Contar clases próximas
  select count(*) into v_upcoming_classes
  from public.live_classes lc
  join public.enrollments e on e.course_id = lc.course_id
  where e.student_id = p_student_id
    and e.status = 'active'
    and lc.scheduled_start between now() and now() + interval '7 days'
    and lc.status = 'scheduled';

  -- Obtener puntos totales y nivel
  select 
    coalesce(sum(total_points), 0),
    max(level_name)
  into v_total_points, v_current_level
  from public.student_points
  where student_id = p_student_id;

  -- Contar logros obtenidos
  select count(*) into v_achievements_count
  from public.student_achievements
  where student_id = p_student_id;

  v_result := jsonb_build_object(
    'enrolled_courses', v_enrolled_courses,
    'pending_tasks', v_pending_tasks,
    'upcoming_classes', v_upcoming_classes,
    'total_points', v_total_points,
    'current_level', coalesce(v_current_level, 'Novice'),
    'achievements_count', v_achievements_count,
    'generated_at', now()
  );

  return v_result;
end;
$$;

-- =============================================
-- FUNCIONES RPC PARA MANEJO DE ROLES
-- =============================================



-- Crear o actualizar rol de usuario en un tenant
create or replace function public.role_create_membership(
  p_user_id uuid,
  p_tenant_id uuid,
  p_role_name text,
  p_permissions jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership_id uuid;
begin
  -- Validar que el rol sea válido
  if p_role_name not in ('owner', 'admin', 'teacher', 'student', 'parent', 'viewer') then
    raise exception 'Rol inválido: %', p_role_name;
  end if;

  -- Crear o actualizar membership
  insert into public.memberships (user_id, tenant_id, role, permissions)
  values (p_user_id, p_tenant_id, p_role_name, p_permissions)
  on conflict (user_id, tenant_id)
  do update set
    role = excluded.role,
    permissions = excluded.permissions,
    updated_at = now()
  returning id into v_membership_id;

  return v_membership_id;
end;
$$;

-- Eliminar membership (desactivar)
create or replace function public.role_delete_membership(
  p_user_id uuid,
  p_tenant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.memberships
  set is_active = false, updated_at = now()
  where user_id = p_user_id and tenant_id = p_tenant_id;
  
  return found;
end;
$$;



-- =============================================
-- FUNCIONES CRUD PARA GESTIÓN DE TENANTS
-- =============================================

-- Crear tenant
DROP FUNCTION IF EXISTS create_tenant(text, text, text, jsonb);
create or replace function create_tenant(
  p_name text,
  p_domain text,
  p_plan text default 'basic',
  p_branding jsonb default '{}'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
begin
  -- Validaciones de entrada
  if p_name is null or trim(p_name) = '' then
    raise exception 'El nombre del tenant es requerido';
  end if;
  
  if p_domain is null or trim(p_domain) = '' then
    raise exception 'El dominio del tenant es requerido';
  end if;
  
  if p_plan not in ('free', 'basic', 'pro') then
    raise exception 'Plan inválido. Debe ser: free, basic, pro';
  end if;
  
  -- Verificar que el dominio no exista
  if exists (select 1 from public.tenants where domain = p_domain) then
    raise exception 'El dominio ya está en uso';
  end if;
  
  -- Crear tenant
  insert into public.tenants (name, domain, plan, branding)
  values (p_name, p_domain, p_plan, p_branding)
  returning id into v_tenant_id;
  
  -- Crear categoría por defecto
  insert into public.categories (tenant_id, name, description)
  values (v_tenant_id, 'General', 'Categoría general para cursos');
  
  return v_tenant_id;
end;
$$;

-- Actualizar tenant
DROP FUNCTION IF EXISTS update_tenant(uuid, text, text, text, jsonb);
create or replace function update_tenant(
  p_tenant_id uuid,
  p_name text default null,
  p_domain text default null,
  p_plan text default null,
  p_branding jsonb default null
)
returns boolean
language plpgsql
security definer
as $$
begin
  -- Verificar permisos (solo super admin)
  if not public.is_platform_admin() then
    raise exception 'No autorizado para actualizar tenants';
  end if;
  
  -- Validaciones
  if p_plan is not null and p_plan not in ('free', 'basic', 'pro') then
    raise exception 'Plan inválido. Debe ser: free, basic, pro';
  end if;
  
  if p_domain is not null and exists (
    select 1 from public.tenants 
    where domain = p_domain and id != p_tenant_id
  ) then
    raise exception 'El dominio ya está en uso';
  end if;
  
  update public.tenants
  set 
    name = coalesce(p_name, name),
    domain = coalesce(p_domain, domain),
    plan = coalesce(p_plan, plan),
    branding = coalesce(p_branding, branding),
    updated_at = now()
  where id = p_tenant_id;
  
  return found;
end;
$$;

-- Desactivar tenant (marcar como inactivo en branding)
create or replace function deactivate_tenant(
  p_tenant_id uuid
)
returns boolean
language plpgsql
security definer
as $$
begin
  -- Verificar permisos (solo super admin)
  if not public.is_platform_admin() then
    raise exception 'No autorizado para desactivar tenants';
  end if;
  
  -- Marcar como inactivo en el branding
  update public.tenants
  set branding = coalesce(branding, '{}') || '{"is_active": false}', updated_at = now()
  where id = p_tenant_id;
  
  return found;
end;
$$;

-- =============================================
-- FUNCIONES CRUD PARA GESTIÓN DE COURSES
-- =============================================

-- Crear course
DROP FUNCTION IF EXISTS create_course(uuid, text, text, uuid, uuid, text, boolean, integer, date, date);
create or replace function create_course(
  p_tenant_id uuid,
  p_title text,
  p_description text,
  p_category_id uuid,
  p_instructor_id uuid default null,
  p_cover_image_url text default null,
  p_is_published boolean default false,
  p_max_students integer default null,
  p_start_date date default null,
  p_end_date date default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_course_id uuid;
  v_user_tenant_id uuid;
begin
  -- Validaciones de entrada
  if p_title is null or trim(p_title) = '' then
    raise exception 'El título del curso es requerido';
  end if;
  
  if p_description is null or trim(p_description) = '' then
    raise exception 'La descripción del curso es requerida';
  end if;
  
  -- Verificar que el usuario pertenece al tenant
  select tenant_id into v_user_tenant_id
  from public.profiles
  where id = coalesce(p_instructor_id, auth.uid());
  
  if v_user_tenant_id != p_tenant_id then
    raise exception 'No autorizado para crear cursos en este tenant';
  end if;
  
  -- Verificar que la categoría existe y pertenece al tenant
  if not exists (
    select 1 from public.categories 
    where id = p_category_id and tenant_id = p_tenant_id
  ) then
    raise exception 'Categoría inválida o no pertenece al tenant';
  end if;
  
  -- Verificar permisos (teacher o tenant_admin)
  if not (public.has_role('teacher') or public.has_role('tenant_admin')) then
    raise exception 'No autorizado para crear cursos';
  end if;
  
  -- Crear course
  insert into public.courses (
    tenant_id, title, description, category_id, instructor_id,
    cover_image_url, is_published, max_students, start_date, end_date
  ) values (
    p_tenant_id, p_title, p_description, p_category_id, 
    coalesce(p_instructor_id, auth.uid()),
    p_cover_image_url, p_is_published, p_max_students, p_start_date, p_end_date
  ) returning id into v_course_id;
  
  return v_course_id;
end;
$$;

-- Actualizar course
create or replace function update_course(
  p_course_id uuid,
  p_title text default null,
  p_description text default null,
  p_category_id uuid default null,
  p_cover_image_url text default null,
  p_is_published boolean default null,
  p_max_students integer default null,
  p_start_date date default null,
  p_end_date date default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_course_tenant_id uuid;
  v_course_instructor_id uuid;
begin
  -- Obtener información del curso
  select tenant_id, instructor_id into v_course_tenant_id, v_course_instructor_id
  from public.courses
  where id = p_course_id;
  
  if not found then
    raise exception 'Curso no encontrado';
  end if;
  
  -- Verificar permisos (instructor del curso o tenant_admin del tenant)
  if not (v_course_instructor_id = auth.uid() or public.has_role('tenant_admin')) then
    raise exception 'No autorizado para actualizar este curso';
  end if;
  
  -- Validar categoría si se proporciona
  if p_category_id is not null and not exists (
    select 1 from public.categories 
    where id = p_category_id and tenant_id = v_course_tenant_id
  ) then
    raise exception 'Categoría inválida o no pertenece al tenant';
  end if;
  
  update public.courses
  set 
    title = coalesce(p_title, title),
    description = coalesce(p_description, description),
    category_id = coalesce(p_category_id, category_id),
    cover_image_url = coalesce(p_cover_image_url, cover_image_url),
    is_published = coalesce(p_is_published, is_published),
    max_students = coalesce(p_max_students, max_students),
    start_date = coalesce(p_start_date, start_date),
    end_date = coalesce(p_end_date, end_date),
    updated_at = now()
  where id = p_course_id;
  
  return found;
end;
$$;

-- Eliminar course
create or replace function delete_course(
  p_course_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_course_instructor_id uuid;
  v_enrollment_count integer;
begin
  -- Obtener instructor del curso
  select instructor_id into v_course_instructor_id
  from public.courses
  where id = p_course_id;
  
  if not found then
    raise exception 'Curso no encontrado';
  end if;
  
  -- Verificar permisos (instructor del curso o tenant_admin)
  if not (v_course_instructor_id = auth.uid() or public.has_role('tenant_admin')) then
    raise exception 'No autorizado para eliminar este curso';
  end if;
  
  -- Verificar que no hay estudiantes inscritos
  select count(*) into v_enrollment_count
  from public.enrollments
  where course_id = p_course_id and status = 'active';
  
  if v_enrollment_count > 0 then
    raise exception 'No se puede eliminar un curso con estudiantes inscritos';
  end if;
  
  -- Eliminar curso (soft delete)
  update public.courses
  set is_published = false, updated_at = now()
  where id = p_course_id;
  
  return found;
end;
$$;

-- Obtener detalles del course
create or replace function get_course_details(
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
  v_course_tenant_id uuid;
begin
  -- Verificar acceso al curso
  select tenant_id into v_course_tenant_id
  from public.courses
  where id = p_course_id;
  
  if not found then
    raise exception 'Curso no encontrado';
  end if;
  
  -- Verificar que el usuario tiene acceso al tenant
  if not public.is_tenant_member(v_course_tenant_id) then
    raise exception 'No autorizado para ver este curso';
  end if;
  
  select jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'description', c.description,
    'cover_image_url', c.cover_image_url,
    'is_published', c.is_published,
    'max_students', c.max_students,
    'start_date', c.start_date,
    'end_date', c.end_date,
    'created_at', c.created_at,
    'updated_at', c.updated_at,
    'category', jsonb_build_object(
      'id', cat.id,
      'name', cat.name,
      'description', cat.description
    ),
    'instructor', jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'avatar_url', p.avatar_url
    ),
    'enrollment_count', (
      select count(*) from public.enrollments e 
      where e.course_id = c.id and e.status = 'active'
    ),
    'task_count', (
      select count(*) from public.tasks t 
      where t.course_id = c.id
    ),
    'resource_count', (
      select count(*) from public.resources r 
      where r.course_id = c.id
    )
  ) into v_result
  from public.courses c
  join public.categories cat on cat.id = c.category_id
  join public.profiles p on p.id = c.instructor_id
  where c.id = p_course_id;
  
  return v_result;
end;
$$;

-- =============================================
-- FUNCIONES CRUD PARA GESTIÓN DE ENROLLMENTS
-- =============================================

-- Inscribir estudiante
create or replace function enroll_student(
  p_course_id uuid,
  p_student_id uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_enrollment_id uuid;
  v_course_tenant_id uuid;
  v_student_tenant_id uuid;
  v_max_students integer;
  v_current_enrollments integer;
begin
  -- Usar el usuario actual si no se especifica estudiante
  p_student_id := coalesce(p_student_id, auth.uid());
  
  -- Verificar que el curso existe y obtener información
  select tenant_id, max_students into v_course_tenant_id, v_max_students
  from public.courses
  where id = p_course_id and is_published = true;
  
  if not found then
    raise exception 'Curso no encontrado o no está publicado';
  end if;
  
  -- Verificar que el estudiante pertenece al mismo tenant
  select tenant_id into v_student_tenant_id
  from public.profiles
  where id = p_student_id;
  
  if v_student_tenant_id != v_course_tenant_id then
    raise exception 'El estudiante no pertenece al mismo tenant del curso';
  end if;
  
  -- Verificar que el usuario tiene rol de estudiante
  if not public.has_role('student') then
    raise exception 'Solo los estudiantes pueden inscribirse en cursos';
  end if;
  
  -- Verificar que no está ya inscrito
  if exists (
    select 1 from public.enrollments 
    where course_id = p_course_id and student_id = p_student_id and status = 'active'
  ) then
    raise exception 'El estudiante ya está inscrito en este curso';
  end if;
  
  -- Verificar límite de estudiantes
  if v_max_students is not null then
    select count(*) into v_current_enrollments
    from public.enrollments
    where course_id = p_course_id and status = 'active';
    
    if v_current_enrollments >= v_max_students then
      raise exception 'El curso ha alcanzado el límite máximo de estudiantes';
    end if;
  end if;
  
  -- Crear enrollment
  insert into public.enrollments (course_id, student_id, status, enrolled_at)
  values (p_course_id, p_student_id, 'active', now())
  returning id into v_enrollment_id;
  
  -- Crear notificación para el instructor
  insert into public.notifications (tenant_id, user_id, title, message, type)
  select 
    c.tenant_id,
    c.instructor_id,
    'Nuevo estudiante inscrito',
    'El estudiante ' || p.full_name || ' se ha inscrito en el curso ' || c.title,
    'enrollment'
  from public.courses c
  join public.profiles p on p.id = p_student_id
  where c.id = p_course_id;
  
  return v_enrollment_id;
end;
$$;

-- Desinscribir estudiante
create or replace function unenroll_student(
  p_course_id uuid,
  p_student_id uuid default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_course_instructor_id uuid;
begin
  -- Usar el usuario actual si no se especifica estudiante
  p_student_id := coalesce(p_student_id, auth.uid());
  
  -- Obtener instructor del curso
  select instructor_id into v_course_instructor_id
  from public.courses
  where id = p_course_id;
  
  if not found then
    raise exception 'Curso no encontrado';
  end if;
  
  -- Verificar permisos (el propio estudiante o instructor/admin)
  if not (p_student_id = auth.uid() or 
          v_course_instructor_id = auth.uid() or 
          public.has_role('admin')) then
    raise exception 'No autorizado para desinscribir este estudiante';
  end if;
  
  -- Actualizar enrollment a inactivo
  update public.enrollments
  set status = 'inactive', updated_at = now()
  where course_id = p_course_id and student_id = p_student_id and status = 'active';
  
  if not found then
    raise exception 'El estudiante no está inscrito en este curso';
  end if;
  
  return true;
end;
$$;

-- Obtener inscripciones del estudiante
create or replace function get_student_enrollments(
  p_student_id uuid default null,
  p_status text default 'active'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  -- Usar el usuario actual si no se especifica estudiante
  p_student_id := coalesce(p_student_id, auth.uid());
  
  -- Verificar permisos (el propio estudiante o tenant_admin)
  if not (p_student_id = auth.uid() or public.has_role('tenant_admin')) then
    raise exception 'No autorizado para ver las inscripciones de este estudiante';
  end if;
  
  select jsonb_agg(
    jsonb_build_object(
      'enrollment_id', e.id,
      'status', e.status,
      'enrolled_at', e.enrolled_at,
      'progress', e.progress,
      'course', jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'description', c.description,
        'cover_image_url', c.cover_image_url,
        'start_date', c.start_date,
        'end_date', c.end_date,
        'instructor', jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        ),
        'category', jsonb_build_object(
          'id', cat.id,
          'name', cat.name
        )
      ),
      'stats', jsonb_build_object(
        'completed_tasks', (
          select count(*) from public.submissions s
          join public.tasks t on t.id = s.task_id
          where t.course_id = c.id and s.student_id = p_student_id
        ),
        'total_tasks', (
          select count(*) from public.tasks t
          where t.course_id = c.id
        ),
        'average_grade', (
          select avg(g.score) from public.grades g
          join public.tasks t on t.id = g.task_id
          where t.course_id = c.id and g.student_id = p_student_id
        )
      )
    )
  ) into v_result
  from public.enrollments e
  join public.courses c on c.id = e.course_id
  join public.profiles p on p.id = c.instructor_id
  join public.categories cat on cat.id = c.category_id
  where e.student_id = p_student_id
    and (p_status is null or e.status = p_status)
  order by e.enrolled_at desc;
  
  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- =============================================
-- FUNCIONES CRUD PARA GESTIÓN DE RESOURCES
-- =============================================

-- Crear resource
DROP FUNCTION IF EXISTS create_resource(uuid, text, text, text, text, text, boolean, integer);
create or replace function create_resource(
  p_course_id uuid,
  p_title text,
  p_description text default null,
  p_type text default 'document',
  p_file_url text default null,
  p_content text default null,
  p_is_downloadable boolean default true,
  p_order_index integer default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_resource_id uuid;
  v_course_instructor_id uuid;
  v_course_tenant_id uuid;
begin
  -- Validaciones de entrada
  if p_title is null or trim(p_title) = '' then
    raise exception 'El título del recurso es requerido';
  end if;
  
  if p_type not in ('document', 'video', 'audio', 'image', 'link', 'text') then
    raise exception 'Tipo de recurso inválido. Debe ser: document, video, audio, image, link, text';
  end if;
  
  if p_type != 'text' and p_file_url is null then
    raise exception 'La URL del archivo es requerida para este tipo de recurso';
  end if;
  
  -- Verificar que el curso existe y obtener información
  select instructor_id, tenant_id into v_course_instructor_id, v_course_tenant_id
  from public.courses
  where id = p_course_id;
  
  if not found then
    raise exception 'Curso no encontrado';
  end if;
  
  -- Verificar permisos (instructor del curso o tenant_admin)
  if not (v_course_instructor_id = auth.uid() or public.has_role('tenant_admin')) then
    raise exception 'No autorizado para crear recursos en este curso';
  end if;
  
  -- Asignar order_index si no se proporciona
  if p_order_index is null then
    select coalesce(max(order_index), 0) + 1 into p_order_index
    from public.resources
    where course_id = p_course_id;
  end if;
  
  -- Crear resource
  insert into public.resources (
    course_id, title, description, type, file_url, content,
    is_downloadable, order_index
  ) values (
    p_course_id, p_title, p_description, p_type, p_file_url, p_content,
    p_is_downloadable, p_order_index
  ) returning id into v_resource_id;
  
  -- Crear notificación para estudiantes inscritos
  insert into public.notifications (tenant_id, user_id, title, message, type)
  select 
    v_course_tenant_id,
    e.student_id,
    'Nuevo recurso disponible',
    'Se ha agregado el recurso "' || p_title || '" al curso ' || c.title,
    'resource'
  from public.enrollments e
  join public.courses c on c.id = e.course_id
  where e.course_id = p_course_id and e.status = 'active';
  
  return v_resource_id;
end;
$$;

-- Actualizar resource
create or replace function update_resource(
  p_resource_id uuid,
  p_title text default null,
  p_description text default null,
  p_type text default null,
  p_file_url text default null,
  p_content text default null,
  p_is_downloadable boolean default null,
  p_order_index integer default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_course_instructor_id uuid;
begin
  -- Obtener instructor del curso
  select c.instructor_id into v_course_instructor_id
  from public.resources r
  join public.courses c on c.id = r.course_id
  where r.id = p_resource_id;
  
  if not found then
    raise exception 'Recurso no encontrado';
  end if;
  
  -- Verificar permisos (instructor del curso o tenant_admin)
  if not (v_course_instructor_id = auth.uid() or public.has_role('tenant_admin')) then
    raise exception 'No autorizado para actualizar este recurso';
  end if;
  
  -- Validar tipo si se proporciona
  if p_type is not null and p_type not in ('document', 'video', 'audio', 'image', 'link', 'text') then
    raise exception 'Tipo de recurso inválido. Debe ser: document, video, audio, image, link, text';
  end if;
  
  update public.resources
  set 
    title = coalesce(p_title, title),
    description = coalesce(p_description, description),
    type = coalesce(p_type, type),
    file_url = coalesce(p_file_url, file_url),
    content = coalesce(p_content, content),
    is_downloadable = coalesce(p_is_downloadable, is_downloadable),
    order_index = coalesce(p_order_index, order_index),
    updated_at = now()
  where id = p_resource_id;
  
  return found;
end;
$$;

-- Eliminar resource
create or replace function delete_resource(
  p_resource_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_course_instructor_id uuid;
begin
  -- Obtener instructor del curso
  select c.instructor_id into v_course_instructor_id
  from public.resources r
  join public.courses c on c.id = r.course_id
  where r.id = p_resource_id;
  
  if not found then
    raise exception 'Recurso no encontrado';
  end if;
  
  -- Verificar permisos (instructor del curso o tenant_admin)
  if not (v_course_instructor_id = auth.uid() or public.has_role('tenant_admin')) then
    raise exception 'No autorizado para eliminar este recurso';
  end if;
  
  -- Eliminar resource
  delete from public.resources
  where id = p_resource_id;
  
  return found;
end;
$$;

-- Obtener resources de un curso
create or replace function get_course_resources(
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
  v_course_tenant_id uuid;
begin
  -- Verificar acceso al curso
  select tenant_id into v_course_tenant_id
  from public.courses
  where id = p_course_id;
  
  if not found then
    raise exception 'Curso no encontrado';
  end if;
  
  -- Verificar que el usuario tiene acceso al tenant
  if not public.is_tenant_member(v_course_tenant_id) then
    raise exception 'No autorizado para ver los recursos de este curso';
  end if;
  
  select jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'title', r.title,
      'description', r.description,
      'type', r.type,
      'file_url', r.file_url,
      'content', r.content,
      'is_downloadable', r.is_downloadable,
      'order_index', r.order_index,
      'created_at', r.created_at,
      'updated_at', r.updated_at
    ) order by r.order_index, r.created_at
  ) into v_result
  from public.resources r
  where r.course_id = p_course_id;
  
  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- =============================================
-- FUNCIONES CRUD PARA GESTIÓN DE SUBMISSIONS
-- =============================================

-- Enviar tarea (submit_task)
create or replace function submit_task(
  p_task_id uuid,
  p_student_id uuid default null,
  p_content text default null,
  p_file_urls text[] default '{}',
  p_submission_type text default 'text'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_submission_id uuid;
  v_task_due_date timestamp;
  v_task_course_id uuid;
  v_task_tenant_id uuid;
  v_allow_late boolean;
  v_is_late boolean := false;
begin
  -- Usar el usuario actual si no se especifica estudiante
  p_student_id := coalesce(p_student_id, auth.uid());
  
  -- Validaciones de entrada
  if p_submission_type not in ('text', 'file', 'mixed') then
    raise exception 'Tipo de envío inválido. Debe ser: text, file, mixed';
  end if;
  
  if p_submission_type in ('text', 'mixed') and (p_content is null or trim(p_content) = '') then
    raise exception 'El contenido es requerido para envíos de tipo texto';
  end if;
  
  if p_submission_type in ('file', 'mixed') and array_length(p_file_urls, 1) is null then
    raise exception 'Al menos un archivo es requerido para envíos de tipo archivo';
  end if;
  
  -- Obtener información de la tarea
  select t.due_date, t.course_id, c.tenant_id, t.allow_late_submission
  into v_task_due_date, v_task_course_id, v_task_tenant_id, v_allow_late
  from public.tasks t
  join public.courses c on c.id = t.course_id
  where t.id = p_task_id;
  
  if not found then
    raise exception 'Tarea no encontrada';
  end if;
  
  -- Verificar que el estudiante está inscrito en el curso
  if not exists (
    select 1 from public.enrollments e
    where e.course_id = v_task_course_id 
      and e.student_id = p_student_id 
      and e.status = 'active'
  ) then
    raise exception 'El estudiante no está inscrito en este curso';
  end if;
  
  -- Verificar si ya existe una submission
  if exists (
    select 1 from public.submissions s
    where s.task_id = p_task_id and s.student_id = p_student_id
  ) then
    raise exception 'Ya existe un envío para esta tarea. Use update_submission para modificarlo';
  end if;
  
  -- Verificar fecha límite
  if v_task_due_date is not null and now() > v_task_due_date then
    v_is_late := true;
    if not v_allow_late then
      raise exception 'La fecha límite para esta tarea ha expirado';
    end if;
  end if;
  
  -- Crear submission
  insert into public.submissions (
    task_id, student_id, content, file_urls, submission_type,
    submitted_at
  ) values (
    p_task_id, p_student_id, p_content, p_file_urls, p_submission_type,
    now()
  ) returning id into v_submission_id;
  
  -- Actualizar progreso de la tarea
  update public.task_progress
  set status = 'submitted', progress_percentage = 100, last_activity = now()
  where task_id = p_task_id and student_id = p_student_id;
  
  -- Crear notificación para el instructor
  insert into public.notifications (tenant_id, user_id, title, message, type)
  select 
    v_task_tenant_id,
    c.instructor_id,
    'Nueva entrega recibida',
    'El estudiante ' || p.full_name || ' ha enviado la tarea "' || t.title || '"',
    'submission'
  from public.courses c
  join public.tasks t on t.course_id = c.id
  join public.profiles p on p.id = p_student_id
  where t.id = p_task_id;
  
  return v_submission_id;
end;
$$;

-- Actualizar submission
create or replace function update_submission(
  p_submission_id uuid,
  p_content text default null,
  p_file_urls text[] default null,
  p_submission_type text default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_submission_student_id uuid;
  v_task_due_date timestamp;
  v_allow_late boolean;
begin
  -- Obtener información de la submission
  select s.student_id, t.due_date, t.allow_late_submission
  into v_submission_student_id, v_task_due_date, v_allow_late
  from public.submissions s
  join public.tasks t on t.id = s.task_id
  where s.id = p_submission_id;
  
  if not found then
    raise exception 'Envío no encontrado';
  end if;
  
  -- Verificar permisos (solo el estudiante que envió puede modificar)
  if v_submission_student_id != auth.uid() then
    raise exception 'No autorizado para modificar este envío';
  end if;
  
  -- Verificar fecha límite si se permite modificación tardía
  if v_task_due_date is not null and now() > v_task_due_date and not v_allow_late then
    raise exception 'No se pueden modificar envíos después de la fecha límite';
  end if;
  
  -- Validar tipo si se proporciona
  if p_submission_type is not null and p_submission_type not in ('text', 'file', 'mixed') then
    raise exception 'Tipo de envío inválido. Debe ser: text, file, mixed';
  end if;
  
  update public.submissions
  set 
    content = coalesce(p_content, content),
    file_urls = coalesce(p_file_urls, file_urls),
    submission_type = coalesce(p_submission_type, submission_type),
    updated_at = now()
  where id = p_submission_id;
  
  return found;
end;
$$;

-- Obtener submissions del estudiante
create or replace function get_student_submissions(
  p_student_id uuid default null,
  p_course_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  -- Usar el usuario actual si no se especifica estudiante
  p_student_id := coalesce(p_student_id, auth.uid());
  
  -- Verificar permisos (el propio estudiante, instructor del curso o tenant_admin)
  if not (p_student_id = auth.uid() or public.has_role('tenant_admin')) then
    -- Si no es el propio estudiante o tenant_admin, verificar si es instructor del curso
    if p_course_id is not null then
      if not exists (
        select 1 from public.courses c
        where c.id = p_course_id and c.instructor_id = auth.uid()
      ) then
        raise exception 'No autorizado para ver las entregas de este estudiante';
      end if;
    else
      raise exception 'No autorizado para ver las entregas de este estudiante';
    end if;
  end if;
  
  select jsonb_agg(
    jsonb_build_object(
      'submission_id', s.id,
      'content', s.content,
      'file_urls', s.file_urls,
      'submission_type', s.submission_type,
      'submitted_at', s.submitted_at,
      'updated_at', s.updated_at,
      'task', jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'description', t.description,
        'due_date', t.due_date,
        'max_score', t.max_score,
        'course', jsonb_build_object(
          'id', c.id,
          'title', c.title
        )
      ),
      'grade', (
        select jsonb_build_object(
          'id', g.id,
          'score', g.score,
          'feedback', g.feedback,
          'graded_at', g.graded_at
        )
        from public.grades g
        where g.task_id = t.id and g.student_id = s.student_id
      )
    ) order by s.submitted_at desc
  ) into v_result
  from public.submissions s
  join public.tasks t on t.id = s.task_id
  join public.courses c on c.id = t.course_id
  where s.student_id = p_student_id
    and (p_course_id is null or c.id = p_course_id);
  
  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- =============================================
-- FUNCIONES CRUD PARA GESTIÓN DE EVALUATIONS
-- =============================================

-- Crear evaluación
create or replace function create_evaluation(
  p_course_id uuid,
  p_title text,
  p_description text default null,
  p_questions jsonb default '[]',
  p_time_limit integer default null,
  p_max_attempts integer default 1,
  p_passing_score integer default 60,
  p_start_date timestamp default null,
  p_end_date timestamp default null,
  p_is_published boolean default false
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_evaluation_id uuid;
  v_course_tenant_id uuid;
  v_instructor_id uuid;
begin
  -- Validaciones de entrada
  if trim(p_title) = '' then
    raise exception 'El título de la evaluación es requerido';
  end if;
  
  if p_max_attempts < 1 then
    raise exception 'El número máximo de intentos debe ser al menos 1';
  end if;
  
  if p_passing_score < 0 or p_passing_score > 100 then
    raise exception 'La puntuación mínima debe estar entre 0 y 100';
  end if;
  
  if p_start_date is not null and p_end_date is not null and p_start_date >= p_end_date then
    raise exception 'La fecha de inicio debe ser anterior a la fecha de fin';
  end if;
  
  -- Obtener información del curso
  select c.tenant_id, c.instructor_id
  into v_course_tenant_id, v_instructor_id
  from public.courses c
  where c.id = p_course_id;
  
  if not found then
    raise exception 'Curso no encontrado';
  end if;
  
  -- Verificar permisos (instructor del curso o admin)
  if not (v_instructor_id = auth.uid() or public.has_role('admin')) then
    raise exception 'No autorizado para crear evaluaciones en este curso';
  end if;
  
  -- Crear evaluación
  insert into public.evaluations (
    course_id, title, description, questions, time_limit,
    max_attempts, passing_score, start_date, end_date, is_published
  ) values (
    p_course_id, trim(p_title), p_description, p_questions, p_time_limit,
    p_max_attempts, p_passing_score, p_start_date, p_end_date, p_is_published
  ) returning id into v_evaluation_id;
  
  -- Crear notificación para estudiantes si se publica inmediatamente
  if p_is_published then
    insert into public.notifications (tenant_id, user_id, title, message, type)
    select 
      v_course_tenant_id,
      e.student_id,
      'Nueva evaluación disponible',
      'Se ha publicado la evaluación "' || p_title || '" en el curso "' || c.title || '"',
      'evaluation'
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    where e.course_id = p_course_id and e.status = 'active';
  end if;
  
  return v_evaluation_id;
end;
$$;

-- Actualizar evaluación
create or replace function update_evaluation(
  p_evaluation_id uuid,
  p_title text default null,
  p_description text default null,
  p_questions jsonb default null,
  p_time_limit integer default null,
  p_max_attempts integer default null,
  p_passing_score integer default null,
  p_start_date timestamp default null,
  p_end_date timestamp default null,
  p_is_published boolean default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_course_id uuid;
  v_instructor_id uuid;
  v_current_published boolean;
  v_course_tenant_id uuid;
begin
  -- Obtener información de la evaluación
  select e.course_id, c.instructor_id, e.is_published, c.tenant_id
  into v_course_id, v_instructor_id, v_current_published, v_course_tenant_id
  from public.evaluations e
  join public.courses c on c.id = e.course_id
  where e.id = p_evaluation_id;
  
  if not found then
    raise exception 'Evaluación no encontrada';
  end if;
  
  -- Verificar permisos (instructor del curso o tenant_admin)
  if not (v_instructor_id = auth.uid() or public.has_role('tenant_admin')) then
    raise exception 'No autorizado para modificar esta evaluación';
  end if;
  
  -- Validaciones si se proporcionan nuevos valores
  if p_title is not null and trim(p_title) = '' then
    raise exception 'El título de la evaluación no puede estar vacío';
  end if;
  
  if p_max_attempts is not null and p_max_attempts < 1 then
    raise exception 'El número máximo de intentos debe ser al menos 1';
  end if;
  
  if p_passing_score is not null and (p_passing_score < 0 or p_passing_score > 100) then
    raise exception 'La puntuación mínima debe estar entre 0 y 100';
  end if;
  
  -- Verificar que no hay intentos activos si se cambian aspectos críticos
  if (p_questions is not null or p_time_limit is not null or p_max_attempts is not null) then
    if exists (
      select 1 from public.evaluation_attempts ea
      where ea.evaluation_id = p_evaluation_id and ea.status = 'in_progress'
    ) then
      raise exception 'No se puede modificar la evaluación mientras hay intentos en progreso';
    end if;
  end if;
  
  -- Actualizar evaluación
  update public.evaluations
  set 
    title = coalesce(trim(p_title), title),
    description = coalesce(p_description, description),
    questions = coalesce(p_questions, questions),
    time_limit = coalesce(p_time_limit, time_limit),
    max_attempts = coalesce(p_max_attempts, max_attempts),
    passing_score = coalesce(p_passing_score, passing_score),
    start_date = coalesce(p_start_date, start_date),
    end_date = coalesce(p_end_date, end_date),
    is_published = coalesce(p_is_published, is_published),
    updated_at = now()
  where id = p_evaluation_id;
  
  -- Notificar si se publica por primera vez
  if p_is_published = true and not v_current_published then
    insert into public.notifications (tenant_id, user_id, title, message, type)
    select 
      v_course_tenant_id,
      e.student_id,
      'Nueva evaluación disponible',
      'Se ha publicado la evaluación "' || coalesce(p_title, ev.title) || '" en el curso "' || c.title || '"',
      'evaluation'
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    join public.evaluations ev on ev.id = p_evaluation_id
    where e.course_id = v_course_id and e.status = 'active';
  end if;
  
  return found;
end;
$$;

-- Eliminar evaluación (soft delete)
create or replace function delete_evaluation(
  p_evaluation_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_course_id uuid;
  v_instructor_id uuid;
begin
  -- Obtener información de la evaluación
  select e.course_id, c.instructor_id
  into v_course_id, v_instructor_id
  from public.evaluations e
  join public.courses c on c.id = e.course_id
  where e.id = p_evaluation_id;
  
  if not found then
    raise exception 'Evaluación no encontrada';
  end if;
  
  -- Verificar permisos (instructor del curso o tenant_admin)
  if not (v_instructor_id = auth.uid() or public.has_role('tenant_admin')) then
    raise exception 'No autorizado para eliminar esta evaluación';
  end if;
  
  -- Verificar que no hay intentos completados
  if exists (
    select 1 from public.evaluation_attempts ea
    where ea.evaluation_id = p_evaluation_id and ea.status = 'completed'
  ) then
    raise exception 'No se puede eliminar una evaluación que ya tiene intentos completados';
  end if;
  
  -- Soft delete: marcar como inactiva
  update public.evaluations
  set is_published = false, updated_at = now()
  where id = p_evaluation_id;
  
  return found;
end;
$$;

-- Obtener detalles de evaluación
create or replace function get_evaluation_details(
  p_evaluation_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
  v_course_id uuid;
  v_instructor_id uuid;
  v_is_enrolled boolean := false;
begin
  -- Obtener información básica de la evaluación
  select e.course_id, c.instructor_id
  into v_course_id, v_instructor_id
  from public.evaluations e
  join public.courses c on c.id = e.course_id
  where e.id = p_evaluation_id;
  
  if not found then
    raise exception 'Evaluación no encontrada';
  end if;
  
  -- Verificar si el usuario está inscrito en el curso
  select exists (
    select 1 from public.enrollments en
    where en.course_id = v_course_id 
      and en.student_id = auth.uid() 
      and en.status = 'active'
  ) into v_is_enrolled;
  
  -- Verificar permisos de acceso
  if not (v_instructor_id = auth.uid() or public.has_role('admin') or v_is_enrolled) then
    raise exception 'No autorizado para ver esta evaluación';
  end if;
  
  select jsonb_build_object(
    'evaluation_id', e.id,
    'title', e.title,
    'description', e.description,
    'questions', case 
      when v_instructor_id = auth.uid() or public.has_role('admin') then e.questions
      else jsonb_array_length(e.questions)
    end,
    'time_limit', e.time_limit,
    'max_attempts', e.max_attempts,
    'passing_score', e.passing_score,
    'start_date', e.start_date,
    'end_date', e.end_date,
    'is_published', e.is_published,
    'created_at', e.created_at,
    'course', jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'instructor', jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name
      )
    ),
    'user_attempts', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'attempt_id', ea.id,
          'attempt_number', ea.attempt_number,
          'score', ea.total_score,
          'status', ea.status,
          'started_at', ea.started_at,
          'completed_at', ea.submitted_at
        ) order by ea.attempt_number
      ), '[]'::jsonb)
      from public.evaluation_attempts ea
      where ea.evaluation_id = e.id and ea.student_id = auth.uid()
    )
  ) into v_result
  from public.evaluations e
  join public.courses c on c.id = e.course_id
  join public.profiles p on p.id = c.instructor_id
  where e.id = p_evaluation_id;
  
  return v_result;
end;
$$;

-- =============================================
-- EXPANSIÓN DEL SISTEMA DE AUDITORÍA
-- =============================================

-- Función para auditar operaciones CRUD de tenants
create or replace function audit_tenant_operations()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('tenants', NEW.id::text, 'CREATE', null, to_jsonb(NEW), auth.uid(), NEW.id);
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('tenants', NEW.id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid(), NEW.id);
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('tenants', OLD.id::text, 'DELETE', to_jsonb(OLD), null, auth.uid(), OLD.id);
    return OLD;
  end if;
  return null;
end;
$$;

-- Función para auditar operaciones CRUD de courses
create or replace function audit_course_operations()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('courses', NEW.id::text, 'CREATE', null, to_jsonb(NEW), auth.uid(), NEW.tenant_id);
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('courses', NEW.id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid(), NEW.tenant_id);
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('courses', OLD.id::text, 'DELETE', to_jsonb(OLD), null, auth.uid(), OLD.tenant_id);
    return OLD;
  end if;
  return null;
end;
$$;

-- Función para auditar operaciones CRUD de enrollments
create or replace function audit_enrollment_operations()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('enrollments', NEW.id::text, 'CREATE', null, to_jsonb(NEW), auth.uid(), NEW.tenant_id);
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('enrollments', NEW.id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid(), NEW.tenant_id);
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('enrollments', OLD.id::text, 'DELETE', to_jsonb(OLD), null, auth.uid(), OLD.tenant_id);
    return OLD;
  end if;
  return null;
end;
$$;

-- Función para auditar operaciones CRUD de resources
create or replace function audit_resource_operations()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('resources', NEW.id::text, 'CREATE', null, to_jsonb(NEW), auth.uid(), NEW.tenant_id);
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('resources', NEW.id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid(), NEW.tenant_id);
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('resources', OLD.id::text, 'DELETE', to_jsonb(OLD), null, auth.uid(), OLD.tenant_id);
    return OLD;
  end if;
  return null;
end;
$$;

-- Función para auditar operaciones CRUD de submissions
create or replace function audit_submission_operations()
returns trigger
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
begin
  -- Obtener tenant_id del curso relacionado
  select c.tenant_id into v_tenant_id
  from public.courses c
  join public.tasks t on t.course_id = c.id
  where t.id = coalesce(NEW.task_id, OLD.task_id);
  
  if TG_OP = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('submissions', NEW.id::text, 'CREATE', null, to_jsonb(NEW), auth.uid(), v_tenant_id);
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('submissions', NEW.id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_tenant_id);
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('submissions', OLD.id::text, 'DELETE', to_jsonb(OLD), null, auth.uid(), v_tenant_id);
    return OLD;
  end if;
  return null;
end;
$$;

-- Función para auditar operaciones CRUD de evaluations
create or replace function audit_evaluation_operations()
returns trigger
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
begin
  -- Obtener tenant_id del curso relacionado
  select c.tenant_id into v_tenant_id
  from public.courses c
  where c.id = coalesce(NEW.course_id, OLD.course_id);
  
  if TG_OP = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('evaluations', NEW.id::text, 'CREATE', null, to_jsonb(NEW), auth.uid(), v_tenant_id);
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('evaluations', NEW.id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_tenant_id);
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.audit_log (table_name, record_id, action, old_values, new_values, user_id, tenant_id)
    values ('evaluations', OLD.id::text, 'DELETE', to_jsonb(OLD), null, auth.uid(), v_tenant_id);
    return OLD;
  end if;
  return null;
end;
$$;

-- Crear triggers para auditoría
create trigger trg_audit_tenants
  after insert or update or delete on public.tenants
  for each row execute function audit_tenant_operations();

create trigger trg_audit_courses
  after insert or update or delete on public.courses
  for each row execute function audit_course_operations();

create trigger trg_audit_enrollments
  after insert or update or delete on public.enrollments
  for each row execute function audit_enrollment_operations();

create trigger trg_audit_resources
  after insert or update or delete on public.resources
  for each row execute function audit_resource_operations();

create trigger trg_audit_submissions
  after insert or update or delete on public.submissions
  for each row execute function audit_submission_operations();

create trigger trg_audit_evaluations
  after insert or update or delete on public.evaluations
  for each row execute function audit_evaluation_operations();

-- Función para consultar auditoría por tabla
create or replace function get_audit_trail(
  p_table_name text,
  p_record_id text default null,
  p_user_id uuid default null,
  p_tenant_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  -- Verificar permisos (solo tenant_admins pueden ver auditoría completa)
  if not public.has_role('tenant_admin') then
    raise exception 'No autorizado para consultar el registro de auditoría';
  end if;
  
  select jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'table_name', a.table_name,
      'record_id', a.record_id,
      'action', a.action,
      'old_values', a.old_values,
      'new_values', a.new_values,
      'user_id', a.user_id,
      'tenant_id', a.tenant_id,
      'created_at', a.created_at,
      'user_info', (
        select jsonb_build_object(
          'full_name', p.full_name,
          'role', p.role
        )
        from public.profiles p
        where p.id = a.user_id
      )
    ) order by a.created_at desc
  ) into v_result
  from public.audit_log a
  where (p_table_name is null or a.table_name = p_table_name)
    and (p_record_id is null or a.record_id = p_record_id)
    and (p_user_id is null or a.user_id = p_user_id)
    and (p_tenant_id is null or a.tenant_id = p_tenant_id)
  limit p_limit;
  
  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- =============================================
-- PERMISOS GRANT EXECUTE ADICIONALES
-- =============================================

-- Funciones de evaluaciones
GRANT EXECUTE ON FUNCTION get_evaluation_with_questions(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION start_evaluation_attempt(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_grade_evaluation(uuid) TO authenticated;

-- Funciones de notificaciones
GRANT EXECUTE ON FUNCTION create_notification(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_notifications(uuid, uuid, boolean, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(uuid, uuid) TO authenticated;

-- Funciones de certificados
GRANT EXECUTE ON FUNCTION issue_certificate(uuid, uuid, uuid, jsonb, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_certificate_templates(uuid, boolean, integer, integer) TO authenticated;

-- Funciones de roles y permisos
GRANT EXECUTE ON FUNCTION public.get_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(text, uuid) TO authenticated;

-- Funciones de clases en vivo
GRANT EXECUTE ON FUNCTION create_live_class(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text, text, integer, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION start_live_class(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION join_live_class(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION leave_live_class(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION add_live_class_comment(uuid, uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION react_to_comment(uuid, uuid, text) TO authenticated;

-- Funciones de comunicación
GRANT EXECUTE ON FUNCTION create_course_discussion(uuid, uuid, uuid, text, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION send_direct_message(uuid, uuid, uuid, text, text, text, text, integer) TO authenticated;

-- Funciones de tareas avanzadas
GRANT EXECUTE ON FUNCTION create_advanced_task(uuid, uuid, text, text, text, timestamptz, numeric, jsonb, jsonb, boolean, numeric, boolean, integer, text, integer, text, text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION update_task_progress(uuid, uuid, text, numeric, integer, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION create_task_group(uuid, text, text, uuid) TO authenticated;

-- Funciones de engagement y analytics
GRANT EXECUTE ON FUNCTION update_daily_engagement(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_academic_risk_alert(uuid, uuid, text, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION award_achievement(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_student_rankings() TO authenticated;

-- Funciones de dashboard
GRANT EXECUTE ON FUNCTION get_instructor_dashboard(uuid, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_dashboard(uuid, uuid) TO authenticated;

-- Funciones de tenants
GRANT EXECUTE ON FUNCTION create_tenant(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION update_tenant(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_tenant(uuid) TO authenticated;

-- Funciones de cursos
GRANT EXECUTE ON FUNCTION create_course(uuid, text, text, uuid, uuid, text, boolean, integer, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION update_course(uuid, text, text, uuid, text, boolean, integer, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_course_details(uuid) TO authenticated;

-- Funciones de inscripciones
GRANT EXECUTE ON FUNCTION enroll_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unenroll_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_enrollments(uuid, text) TO authenticated;

-- Funciones de recursos
GRANT EXECUTE ON FUNCTION create_resource(uuid, text, text, text, text, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION update_resource(uuid, text, text, text, text, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_resource(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_course_resources(uuid) TO authenticated;

-- Funciones de submissions
GRANT EXECUTE ON FUNCTION submit_task(uuid, uuid, text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_submission(uuid, text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_submissions(uuid, uuid) TO authenticated;

-- Funciones de evaluaciones CRUD
GRANT EXECUTE ON FUNCTION create_evaluation(uuid, text, text, jsonb, integer, integer, integer, timestamp, timestamp, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION update_evaluation(uuid, text, text, jsonb, integer, integer, integer, timestamp, timestamp, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_evaluation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_evaluation_details(uuid) TO authenticated;

-- Funciones de auditoría
GRANT EXECUTE ON FUNCTION get_audit_trail(text, text, uuid, uuid, integer) TO authenticated;

commit;
