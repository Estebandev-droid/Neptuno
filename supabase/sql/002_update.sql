-- 002_update.sql
-- Mantenimiento: triggers updated_at y sincronización de platform_admins con user_roles.

begin;

-- Función genérica para updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

-- Triggers updated_at (idempotentes)
drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_certificate_templates_updated_at on public.certificate_templates;
create trigger trg_certificate_templates_updated_at
before update on public.certificate_templates
for each row execute function public.set_updated_at();

-- Sincronizar platform_admins con user_roles(platform_admin, tenant_id null)
create or replace function public.sync_platform_admins()
returns trigger
language plpgsql as $$
declare v_role_name text; begin
  if tg_op = 'INSERT' then
    select r.name into v_role_name from public.roles r where r.id = new.role_id;
    if v_role_name = 'platform_admin' and new.tenant_id is null then
      insert into public.platform_admins(user_id) values (new.user_id)
      on conflict (user_id) do nothing;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    select r.name into v_role_name from public.roles r where r.id = old.role_id;
    if v_role_name = 'platform_admin' and old.tenant_id is null then
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

-- Triggers para las nuevas tablas
create trigger courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger course_modules_updated_at
  before update on public.course_modules
  for each row execute function public.set_updated_at();

create trigger lessons_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

create trigger resource_library_updated_at
  before update on public.resource_library
  for each row execute function public.set_updated_at();

-- Función para crear notificaciones automáticas
create or replace function public.create_notification()
returns trigger language plpgsql security definer as $$
begin
  -- Notificación cuando se asigna una nueva tarea
  if TG_TABLE_NAME = 'tasks' and TG_OP = 'INSERT' then
    insert into public.notifications (user_id, title, message, type)
    select e.student_id, 'Nueva tarea asignada', 'Nueva tarea asignada: ' || NEW.title, 'academic'
    from public.enrollments e
    where e.course_id = NEW.course_id and e.status = 'active';
  end if;

  -- Notificación cuando se califica una entrega
  if TG_TABLE_NAME = 'submissions' and TG_OP = 'UPDATE' and OLD.grade is null and NEW.grade is not null then
    insert into public.notifications (user_id, title, message, type)
    values (NEW.student_id, 'Tarea calificada', 'Tu tarea ha sido calificada', 'academic');
  end if;

  -- Notificación cuando se agrega una observación
  if TG_TABLE_NAME = 'observations' and TG_OP = 'INSERT' then
    -- Notificar al estudiante
    insert into public.notifications (user_id, title, message, type)
    values (NEW.student_id, 'Nueva observación', 'Se agregó una nueva observación a tu perfil', 'observation');
    
    -- Notificar a los padres
    insert into public.notifications (user_id, title, message, type)
    select psr.parent_id, 'Nueva observación del estudiante', 'Nueva observación sobre tu hijo/a', 'observation'
    from public.parent_student_relationships psr
    where psr.student_id = NEW.student_id;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

-- Triggers para notificaciones automáticas
create trigger tasks_notification_trigger
  after insert on public.tasks
  for each row execute function public.create_notification();

create trigger submissions_notification_trigger
  after update on public.submissions
  for each row execute function public.create_notification();

create trigger observations_notification_trigger
  after insert on public.observations
  for each row execute function public.create_notification();

-- Función para actualizar progreso de lecciones
create or replace function public.update_lesson_progress()
returns trigger language plpgsql security definer as $$
begin
  -- Actualizar last_accessed_at cuando se modifica el progreso
  NEW.last_accessed_at = now();
  
  -- Si se marca como completada, establecer completed_at
  if NEW.status = 'completed' and OLD.status != 'completed' then
    NEW.completed_at = now();
  end if;
  
  return NEW;
end;
$$;

create trigger lesson_progress_update_trigger
  before update on public.lesson_progress
  for each row execute function public.update_lesson_progress();

-- Triggers updated_at para Etapa 1
drop trigger if exists trg_academic_years_updated_at on public.academic_years;
create trigger trg_academic_years_updated_at
before update on public.academic_years
for each row execute function public.set_updated_at();

drop trigger if exists trg_terms_updated_at on public.terms;
create trigger trg_terms_updated_at
before update on public.terms
for each row execute function public.set_updated_at();

drop trigger if exists trg_classrooms_updated_at on public.classrooms;
create trigger trg_classrooms_updated_at
before update on public.classrooms
for each row execute function public.set_updated_at();

drop trigger if exists trg_sections_updated_at on public.sections;
create trigger trg_sections_updated_at
before update on public.sections
for each row execute function public.set_updated_at();

-- Triggers para tablas de Etapa 2
drop trigger if exists set_updated_at_subjects on public.subjects;
create trigger set_updated_at_subjects
  before update on public.subjects
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_announcements on public.announcements;
create trigger set_updated_at_announcements
  before update on public.announcements
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_events on public.events;
create trigger set_updated_at_events
  before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_notification_preferences on public.notification_preferences;
create trigger set_updated_at_notification_preferences
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- Triggers para tablas de Etapa 3
drop trigger if exists set_updated_at_question_bank on public.question_bank;
create trigger set_updated_at_question_bank
  before update on public.question_bank
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_rubrics on public.rubrics;
create trigger set_updated_at_rubrics
  before update on public.rubrics
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_invoices on public.invoices;
create trigger set_updated_at_invoices
  before update on public.invoices
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_scholarships on public.scholarships;
create trigger set_updated_at_scholarships
  before update on public.scholarships
  for each row execute function public.set_updated_at();

-- Triggers para tablas de Etapa 4
drop trigger if exists set_updated_at_library_loans on public.library_loans;
create trigger set_updated_at_library_loans
  before update on public.library_loans
  for each row execute function public.set_updated_at();

-- Función para auditoría automática
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

drop trigger if exists audit_payments on public.payments;
create trigger audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.audit_trigger();

commit;