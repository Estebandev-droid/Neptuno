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
    if new.role in ('super_admin', 'platform_admin') then
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
  select attempts_allowed into max_attempts
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
    select 1 from public.profiles p where p.id = p_user and p.role in ('super_admin','platform_admin')
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

-- Obtener memberships de un usuario
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
-- SIN causar auto-login del usuario creado
CREATE OR REPLACE FUNCTION public.create_user_admin(
  p_email text,
  p_password text,
  p_full_name text DEFAULT NULL,
  p_role_name text DEFAULT 'student',
  p_phone text DEFAULT NULL,
  p_signature_url text DEFAULT NULL,
  p_photo_url text DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id uuid;
  v_role_id uuid;
  v_tenant_id uuid;
  v_result jsonb;
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
  IF p_role_name NOT IN ('student', 'teacher', 'admin', 'super_admin', 'tenant_admin') THEN
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

  -- Generar UUID para el nuevo usuario
  v_user_id := gen_random_uuid();

  -- Crear perfil en public.profiles
  INSERT INTO public.profiles (
    id, full_name, signature_url, avatar_url, tenant_id, role
  ) VALUES (
    v_user_id, p_full_name, p_signature_url, p_photo_url, v_tenant_id, p_role_name
  );

  -- Crear membership
  INSERT INTO public.memberships (user_id, tenant_id, role, is_active)
  VALUES (v_user_id, v_tenant_id, p_role_name, true);

  -- Si es admin, agregarlo a platform_admins
  IF p_role_name IN ('admin', 'super_admin', 'tenant_admin') THEN
    INSERT INTO public.platform_admins (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'message', 'Usuario creado exitosamente. Debe configurar su cuenta usando la API de administración de Supabase.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error al crear usuario: ' || SQLERRM
    );
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.create_user_admin TO authenticated;

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

commit;
