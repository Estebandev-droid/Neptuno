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

commit;
