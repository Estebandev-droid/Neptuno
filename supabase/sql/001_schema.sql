-- 001_schema.sql
-- Estructura base de datos para Neptuno (sistema educativo simplificado)
-- ADVERTENCIA: Este script es DESTRUCTIVO (DROP ... CASCADE) para facilitar reseteo del entorno de desarrollo.
-- Ejecútalo en el SQL editor de Supabase.

begin;

-- Extensiones
create extension if not exists pgcrypto;

-- Tipos
-- Roles parametrizables (solo plataforma)
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, role_id)
);

do $$ begin
  create type public.resource_type as enum ('pdf','video','doc','link','image','audio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.eval_type as enum ('quiz','midterm','final');
exception when duplicate_object then null; end $$;

-- Drop en orden inverso de dependencias
drop table if exists public.grades cascade;
drop table if exists public.evaluations cascade;
drop table if exists public.submissions cascade;
drop table if exists public.tasks cascade;
drop table if exists public.resources cascade;
drop table if exists public.enrollments cascade;
drop table if exists public.courses cascade;
drop table if exists public.categories cascade;
drop table if exists public.platform_admins cascade;
drop table if exists public.profiles cascade;
drop table if exists public.certificates cascade;
drop table if exists public.analytics_events cascade;

-- Perfiles (vinculados a auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  signature_url text, -- Campo opcional para firma digital
  photo_url text, -- Campo opcional para foto del usuario
  extra jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Admins de plataforma (acceso global)
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Categorías del catálogo
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  attributes jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Sedes/Campus (instituciones pueden tener múltiples sedes)
create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  email text,
  image_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Áreas académicas (departamentos, facultades)
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid references public.campuses(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  head_teacher_id uuid references auth.users(id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz,
  unique(campus_id, code)
);

-- Cursos
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references public.areas(id) on delete set null,
  campus_id uuid references public.campuses(id) on delete set null,
  title text not null,
  code text not null unique,
  description text,
  cover_image text,
  academic_period text,
  credits integer default 0,
  max_students integer,
  instructor_id uuid references auth.users(id) on delete set null,
  is_active boolean default true,
  start_date date,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Módulos de cursos (organización de contenido)
create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  order_index integer not null,
  is_published boolean default false,
  unlock_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Lecciones dentro de módulos
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  content text,
  lesson_type text check (lesson_type in ('video','text','interactive','quiz','assignment')) not null,
  duration_minutes integer,
  order_index integer not null,
  is_mandatory boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Matrículas
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz default now(),
  status text check (status in ('active','completed','dropped')) default 'active',
  unique (student_id, course_id)
);

-- Recursos (archivos/enlaces del curso)
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  type public.resource_type not null,
  title text,
  url text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Tareas
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null,
  description text,
  instructions text,
  task_type text check (task_type in ('assignment','project','essay','presentation','lab')) default 'assignment',
  max_score numeric(5,2) default 100,
  due_date date,
  late_submission_allowed boolean default true,
  late_penalty_percentage integer default 0,
  attachment_url text,
  rubric jsonb default '{}'::jsonb,
  is_published boolean default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Entregas
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  file_url text,
  grade numeric,
  feedback text,
  submitted_at timestamptz default now(),
  unique (task_id, student_id)
);

-- Evaluaciones
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  type public.eval_type not null,
  date date,
  attachment_url text,
  created_at timestamptz default now()
);

-- Notas por evaluación
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  score numeric,
  created_at timestamptz default now(),
  unique (evaluation_id, student_id)
);

-- Trigger de creación de perfil al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  v_student_role_id uuid;
begin
  -- Crear perfil del usuario
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  
  -- Asignar rol de estudiante por defecto
  select id into v_student_role_id from public.roles where name = 'student';
  if v_student_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, v_student_role_id)
    on conflict (user_id, role_id) do nothing;
  end if;
  
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Buckets de Storage (idempotentes)
insert into storage.buckets (id, name, public)
values ('media','media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('certificates','certificates', false)
on conflict (id) do nothing;

-- Plantillas de certificados personalizables
create table public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  template_type text check (template_type in ('completion','achievement','participation','excellence')) not null,
  design_config jsonb not null default '{}'::jsonb, -- configuración visual (colores, fuentes, layout)
  background_image_url text,
  logo_url text,
  signature_fields jsonb default '[]'::jsonb, -- campos de firmas
  variable_fields jsonb default '[]'::jsonb, -- campos dinámicos (nombre, curso, fecha, etc.)
  is_active boolean default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Certificados emitidos
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.certificate_templates(id) on delete restrict,
  issued_to uuid not null references auth.users(id) on delete cascade,
  issued_by uuid references auth.users(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  certificate_data jsonb default '{}'::jsonb, -- datos específicos del certificado
  pdf_url text,
  qr_code_url text, -- imagen del código QR
  verification_code text unique not null default encode(gen_random_bytes(12), 'hex'),
  verification_url text, -- URL pública para verificar
  status text check (status in ('draft','issued','revoked')) default 'draft',
  issued_at timestamptz default now(),
  expires_at timestamptz
);

-- Relaciones padre-estudiante
create table public.parent_student_relationships (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  relationship_type text check (relationship_type in ('father','mother','guardian','tutor')) not null,
  is_primary boolean default false,
  created_at timestamptz default now(),
  unique(parent_id, student_id)
);

-- Observaciones de profesores sobre estudiantes
create table public.observations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  observation_type text check (observation_type in ('academic','behavioral','positive','concern')) not null,
  title text not null,
  content text not null,
  is_visible_to_parents boolean default true,
  created_at timestamptz default now()
);

-- Sistema de notificaciones
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text check (type in ('system','academic','administrative','payment','observation')) not null,
  priority text check (priority in ('low','medium','high','urgent')) default 'medium',
  is_read boolean default false,
  action_url text,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- Documentos de admisión/matrícula
create table public.admission_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null, -- 'cedula', 'diploma', 'foto', 'certificado_medico', etc.
  file_name text not null,
  file_url text not null,
  file_size bigint,
  mime_type text,
  status text check (status in ('pending','approved','rejected','expired')) default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  uploaded_at timestamptz default now()
);

-- Control de asistencias
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  date date not null,
  status text check (status in ('present','absent','late','excused')) not null,
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique(student_id, course_id, date)
);

-- Sistema de pagos/facturación
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  concept text not null, -- 'matricula', 'mensualidad', 'certificado', etc.
  amount numeric(10,2) not null,
  currency text default 'COP',
  due_date date,
  status text check (status in ('pending','paid','overdue','cancelled','refunded')) default 'pending',
  payment_method text,
  transaction_id text,
  receipt_url text,
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Sistema de formularios dinámicos
create table public.forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  form_type text check (form_type in ('evaluation','admission','survey','feedback')) not null,
  course_id uuid references public.courses(id) on delete cascade,
  is_active boolean default true,
  allow_multiple_submissions boolean default false,
  start_date timestamptz,
  end_date timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Preguntas de formularios
create table public.form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  question_text text not null,
  question_type text check (question_type in ('multiple_choice','single_choice','text','textarea','number','date','file','rating')) not null,
  is_required boolean default false,
  order_index integer not null,
  points numeric(5,2) default 0, -- para evaluaciones con puntaje
  metadata jsonb default '{}'::jsonb, -- configuraciones adicionales
  created_at timestamptz default now()
);

-- Opciones para preguntas de selección
create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.form_questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean default false, -- para evaluaciones
  order_index integer not null,
  created_at timestamptz default now()
);

-- Respuestas a formularios
create table public.form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.form_questions(id) on delete cascade,
  response_text text,
  selected_option_id uuid references public.question_options(id) on delete set null,
  file_url text, -- para respuestas tipo archivo
  numeric_value numeric,
  submitted_at timestamptz default now(),
  unique(form_id, user_id, question_id)
);

-- Resultados de formularios (resumen por usuario)
create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  total_score numeric(5,2),
  max_possible_score numeric(5,2),
  percentage numeric(5,2),
  status text check (status in ('in_progress','submitted','graded')) default 'in_progress',
  started_at timestamptz default now(),
  submitted_at timestamptz,
  graded_by uuid references auth.users(id) on delete set null,
  graded_at timestamptz,
  feedback text,
  unique(form_id, user_id)
);


-- Progreso de estudiantes en lecciones
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status text check (status in ('not_started','in_progress','completed','skipped')) default 'not_started',
  progress_percentage integer default 0 check (progress_percentage >= 0 and progress_percentage <= 100),
  time_spent_minutes integer default 0,
  started_at timestamptz,
  completed_at timestamptz,
  last_accessed_at timestamptz default now(),
  unique(lesson_id, student_id)
);

-- Eventos para métricas (tracking genérico)
create table public.analytics_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  properties jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Comunicación entre padres y profesores
create table public.parent_teacher_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  message text not null,
  is_read boolean default false,
  parent_message_id uuid references public.parent_teacher_messages(id) on delete set null, -- para hilos de conversación
  attachment_url text,
  sent_at timestamptz default now()
);

-- Horarios de clases
create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6), -- 0=domingo, 6=sábado
  start_time time not null,
  end_time time not null,
  classroom text,
  is_active boolean default true,
  effective_from date default current_date,
  effective_until date
);

-- Biblioteca de recursos compartidos
create table public.resource_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  resource_type text check (resource_type in ('book','article','video','document','link','tool')) not null,
  subject_area text,
  grade_level text,
  file_url text,
  external_url text,
  tags text[] default '{}',
  is_public boolean default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  download_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Calendario académico (Etapa 1)
create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date not null,
  end_date date not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  order_index integer,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz,
  unique(academic_year_id, name)
);

-- Aulas físicas/virtuales
create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid references public.campuses(id) on delete cascade,
  code text not null,
  name text,
  capacity integer check (capacity >= 0),
  location text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz,
  unique(campus_id, code)
);

-- Secciones de curso por periodo
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  term_id uuid references public.terms(id) on delete set null,
  classroom_id uuid references public.classrooms(id) on delete set null,
  code text not null,
  schedule jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz,
  unique(course_id, code)
);

-- Docentes asignados a curso/periodo
create table public.course_instructors (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  instructor_id uuid not null references auth.users(id) on delete cascade,
  term_id uuid references public.terms(id) on delete set null,
  role text check (role in ('lead','assistant','guest')) default 'lead',
  assigned_at timestamptz default now(),
  unique(course_id, instructor_id, term_id)
);

-- Materias/Asignaturas (Etapa 2)
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references public.areas(id) on delete set null,
  code text not null unique,
  name text not null,
  description text,
  credits integer default 0,
  prerequisites text[] default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Currículum por programa
create table public.curriculum (
  id uuid primary key default gen_random_uuid(),
  program_name text not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  semester integer check (semester >= 1),
  is_mandatory boolean default true,
  created_at timestamptz default now(),
  unique(program_name, subject_id)
);

-- Anuncios institucionales
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  announcement_type text check (announcement_type in ('general','academic','administrative','emergency')) default 'general',
  target_audience text[] default '{}', -- roles que pueden ver el anuncio
  is_published boolean default false,
  publish_date timestamptz,
  expire_date timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Eventos del calendario
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text check (event_type in ('class','exam','meeting','holiday','activity')) not null,
  start_datetime timestamptz not null,
  end_datetime timestamptz not null,
  location text,
  course_id uuid references public.courses(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Preferencias de notificaciones
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  email_enabled boolean default true,
  push_enabled boolean default true,
  sms_enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz,
  unique(user_id, notification_type)
);

-- Banco de preguntas (Etapa 3)
create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete set null,
  question_text text not null,
  question_type text check (question_type in ('multiple_choice','true_false','short_answer','essay')) not null,
  difficulty_level text check (difficulty_level in ('easy','medium','hard')) default 'medium',
  points numeric(5,2) default 1,
  explanation text,
  tags text[] default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Opciones para preguntas del banco
create table public.question_bank_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank(id) on delete cascade,
  option_text text not null,
  is_correct boolean default false,
  order_index integer not null,
  created_at timestamptz default now()
);

-- Rúbricas de evaluación
create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  subject_id uuid references public.subjects(id) on delete set null,
  criteria jsonb not null default '[]'::jsonb, -- criterios de evaluación
  scale_type text check (scale_type in ('numeric','descriptive','percentage')) default 'numeric',
  max_score numeric(5,2) default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Facturas y cobros
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  invoice_number text not null unique,
  concept text not null,
  subtotal numeric(10,2) not null,
  tax_amount numeric(10,2) default 0,
  total_amount numeric(10,2) not null,
  currency text default 'COP',
  due_date date not null,
  status text check (status in ('draft','sent','paid','overdue','cancelled')) default 'draft',
  payment_terms text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Becas y descuentos
create table public.scholarships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  scholarship_type text check (scholarship_type in ('academic','need_based','sports','merit')) not null,
  discount_percentage numeric(5,2) check (discount_percentage >= 0 and discount_percentage <= 100),
  discount_amount numeric(10,2),
  eligibility_criteria jsonb default '{}'::jsonb,
  max_recipients integer,
  start_date date,
  end_date date,
  is_active boolean default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Asignación de becas a estudiantes
create table public.student_scholarships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  awarded_date date default current_date,
  status text check (status in ('active','suspended','completed','cancelled')) default 'active',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique(student_id, scholarship_id)
);

-- Log de auditoría
create table public.audit_log (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

-- Préstamos de biblioteca completo (Etapa 4)
create table public.library_loans (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.resource_library(id) on delete cascade,
  borrower_id uuid not null references auth.users(id) on delete cascade,
  loan_date date default current_date,
  due_date date not null,
  return_date date,
  status text check (status in ('active','returned','overdue','lost','damaged')) default 'active',
  renewal_count integer default 0,
  max_renewals integer default 2,
  fine_amount numeric(8,2) default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Sistema de gamificación - Insignias
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  icon_url text,
  badge_type text check (badge_type in ('achievement','participation','excellence','milestone')) not null,
  criteria jsonb default '{}'::jsonb, -- condiciones para obtener la insignia
  points_value integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Insignias otorgadas a usuarios
create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_date date default current_date,
  awarded_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, badge_id)
);

-- Sistema de puntos
create table public.user_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null,
  reason text not null,
  reference_type text, -- 'badge', 'task', 'attendance', etc.
  reference_id uuid,
  awarded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Vista de puntos totales por usuario
create or replace view public.user_total_points as
select 
  user_id,
  sum(points) as total_points,
  count(*) as total_transactions,
  max(created_at) as last_activity
from public.user_points
group by user_id;

commit;