-- =============================================
-- FUNCIONES RPC PARA NOTIFICACIONES Y CERTIFICADOS
-- =============================================

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

-- Marcar todas las notificaciones como leídas
create or replace function mark_all_notifications_read(
  p_user_id uuid,
  p_tenant_id uuid default null
)
returns integer
language plpgsql
security definer
as $$
declare
  updated_count integer;
begin
  update public.notifications
  set is_read = true
  where user_id = p_user_id
    and is_read = false
    and (p_tenant_id is null or tenant_id = p_tenant_id);
  
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

-- Eliminar notificación
create or replace function delete_notification(
  p_notification_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from public.notifications
  where id = p_notification_id
    and user_id = p_user_id;
  
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
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

-- Listar certificados
create or replace function get_certificates(
  p_tenant_id uuid default null,
  p_student_id uuid default null,
  p_course_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  tenant_id uuid,
  student_id uuid,
  course_id uuid,
  template jsonb,
  qr_code text,
  signed_by uuid,
  issued_at timestamptz,
  student_name text,
  course_title text,
  signer_name text
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    c.id,
    c.tenant_id,
    c.student_id,
    c.course_id,
    c.template,
    c.qr_code,
    c.signed_by,
    c.issued_at,
    p_student.full_name as student_name,
    co.title as course_title,
    p_signer.full_name as signer_name
  from public.certificates c
  left join public.profiles p_student on c.student_id = p_student.id
  left join public.courses co on c.course_id = co.id
  left join public.profiles p_signer on c.signed_by = p_signer.id
  where (p_tenant_id is null or c.tenant_id = p_tenant_id)
    and (p_student_id is null or c.student_id = p_student_id)
    and (p_course_id is null or c.course_id = p_course_id)
  order by c.issued_at desc
  limit p_limit
  offset p_offset;
end;
$$;

-- Verificar certificado por QR
create or replace function verify_certificate_by_qr(
  p_qr_code text
)
returns table (
  id uuid,
  student_name text,
  course_title text,
  issued_at timestamptz,
  is_valid boolean
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    c.id,
    p.full_name as student_name,
    co.title as course_title,
    c.issued_at,
    true as is_valid
  from public.certificates c
  left join public.profiles p on c.student_id = p.id
  left join public.courses co on c.course_id = co.id
  where c.qr_code = p_qr_code;
  
  -- Si no se encuentra, retornar registro inválido
  if not found then
    return query
    select 
      null::uuid as id,
      null::text as student_name,
      null::text as course_title,
      null::timestamptz as issued_at,
      false as is_valid;
  end if;
end;
$$;

-- Obtener certificados de un estudiante
create or replace function get_student_certificates(
  p_student_id uuid,
  p_tenant_id uuid default null
)
returns table (
  id uuid,
  course_title text,
  course_description text,
  qr_code text,
  issued_at timestamptz,
  signer_name text
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    c.id,
    co.title as course_title,
    co.description as course_description,
    c.qr_code,
    c.issued_at,
    p.full_name as signer_name
  from public.certificates c
  left join public.courses co on c.course_id = co.id
  left join public.profiles p on c.signed_by = p.id
  where c.student_id = p_student_id
    and (p_tenant_id is null or c.tenant_id = p_tenant_id)
  order by c.issued_at desc;
end;
$$;

-- Eliminar certificado
create or replace function delete_certificate(
  p_certificate_id uuid,
  p_tenant_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from public.certificates
  where id = p_certificate_id
    and tenant_id = p_tenant_id;
  
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

-- =============================================
-- FUNCIONES AUXILIARES
-- =============================================

-- Contar notificaciones no leídas
create or replace function count_unread_notifications(
  p_user_id uuid,
  p_tenant_id uuid default null
)
returns integer
language plpgsql
security definer
as $$
declare
  unread_count integer;
begin
  select count(*)
  into unread_count
  from public.notifications
  where user_id = p_user_id
    and is_read = false
    and (p_tenant_id is null or tenant_id = p_tenant_id);
  
  return coalesce(unread_count, 0);
end;
$$;

-- Enviar notificación a todos los estudiantes de un curso
create or replace function notify_course_students(
  p_course_id uuid,
  p_title text,
  p_message text,
  p_type text default 'academic'
)
returns integer
language plpgsql
security definer
as $$
declare
  notification_count integer := 0;
  student_record record;
begin
  for student_record in
    select e.student_id, c.tenant_id
    from public.enrollments e
    join public.courses c on e.course_id = c.id
    where e.course_id = p_course_id
      and e.status = 'active'
  loop
    insert into public.notifications (
      tenant_id,
      user_id,
      title,
      message,
      type
    ) values (
      student_record.tenant_id,
      student_record.student_id,
      p_title,
      p_message,
      p_type
    );
    
    notification_count := notification_count + 1;
  end loop;
  
  return notification_count;
end;
$$;