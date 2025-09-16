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
-- Sincronizar platform_admins con user_roles (role = 'platform_admin')
-- =============================================
create or replace function public.sync_platform_admins()
returns trigger
language plpgsql as $$
declare v_role_name text; 
begin
  if tg_op = 'INSERT' then
    select r.name into v_role_name from public.roles r where r.id = new.role_id;
    if v_role_name = 'platform_admin' then
      insert into public.platform_admins(user_id) values (new.user_id)
      on conflict (user_id) do nothing;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    select r.name into v_role_name from public.roles r where r.id = old.role_id;
    if v_role_name = 'platform_admin' then
      delete from public.platform_admins pa where pa.user_id = old.user_id;
    end if;
    return old;
  end if;
  return null;
end; $$;

drop trigger if exists trg_user_roles_sync_pa_ins on public.user_roles;
create trigger trg_user_roles_sync_pa_ins
after insert on public.user_roles
for each row execute function public.sync_platform_admins();

drop trigger if exists trg_user_roles_sync_pa_del on public.user_roles;
create trigger trg_user_roles_sync_pa_del
after delete on public.user_roles
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
  p_evaluation_id uuid,
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
  select min(r.name)
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user
$$;

create or replace function public.is_platform_admin(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.platform_admins pa where pa.user_id = p_user
    union
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user and r.name in ('platform_admin','superadmin')
  )
$$;

create or replace function public.has_role(p_role_name text, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user and r.name = p_role_name
  )
$$;

-- Gestión de roles
create or replace function public.role_create(p_name text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.roles(name, description)
  values (trim(p_name), p_description)
  on conflict (name) do update set description = coalesce(excluded.description, public.roles.description)
  returning id into v_id;
  return v_id;
end; $$;

-- Asignación de roles a usuarios
create or replace function public.user_role_assign(p_user uuid, p_role_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_role_id uuid;
begin
  select id into v_role_id from public.roles where name = trim(p_role_name);
  if v_role_id is null then
    raise exception 'Rol % no existe', p_role_name using errcode = 'P0001';
  end if;
  insert into public.user_roles(user_id, role_id)
  values (p_user, v_role_id)
  on conflict (user_id, role_id) do nothing;
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

commit;
