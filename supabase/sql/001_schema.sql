-- =============================================
-- SCHEMA OPTIMIZADO PARA NEPTUNO (FINAL)
-- =============================================

-- Extensiones necesarias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================
-- TABLA BASE: Tenants (Instituciones)
-- =============================================
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique,
  branding jsonb, -- { "logo_url": "...", "primary_color": "#0033CC" }
  plan text check (plan in ('free','basic','pro')) default 'basic',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- TABLA ESENCIAL: Perfiles de usuarios
-- =============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null, -- Campo legacy, se mantendrá por compatibilidad
  email text not null, -- Sin unique constraint - el email único está en auth.users
  full_name text not null,
  avatar_url text, -- Imagen de perfil
  signature_url text, -- Firma digital escaneada o generada
  role text check (role in ('super_admin','tenant_admin','teacher','student','parent')) not null default 'student',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- TABLA ESENCIAL: Administradores de plataforma
-- =============================================
create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  permissions text[] default array['read','write','delete','manage_users'],
  created_at timestamptz default now(),
  unique(user_id)
);

-- =============================================
-- TABLA OPCIONAL: Categorías para organización
-- =============================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, name)
);

-- =============================================
-- TABLA BÁSICA: Cursos
-- =============================================
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  cover_image text, -- Imagen de portada del curso
  category_id uuid references public.categories(id) on delete set null,
  instructor_id uuid references auth.users(id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- TABLA BÁSICA: Inscripciones
-- =============================================
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz default now(),
  status text check (status in ('active','completed','dropped')) default 'active',
  unique(student_id, course_id)
);

-- =============================================
-- TABLA BÁSICA: Recursos
-- =============================================
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  resource_type text check (resource_type in ('document','video','link','image')) not null,
  file_url text,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- TABLA BÁSICA: Tareas
-- =============================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  max_score numeric(5,2) default 100,
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- TABLA BÁSICA: Entregas de tareas
-- =============================================
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  content text,
  file_url text,
  submitted_at timestamptz default now(),
  graded_at timestamptz,
  unique(task_id, student_id)
);

-- =============================================
-- TABLA BÁSICA: Evaluaciones
-- =============================================
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  instructor_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  max_score numeric(5,2) default 100.00,
  is_published boolean default false,
  evaluation_type text check (evaluation_type in ('quiz','exam','project','assignment')) default 'quiz',
  duration_minutes integer default 60,
  instructions text,
  start_date timestamptz,
  end_date timestamptz,
  attempts_allowed integer default 1,
  show_results boolean default true,
  randomize_questions boolean default false,
  passing_score numeric(5,2) default 60.00,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- TABLA BÁSICA: Calificaciones
-- =============================================
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  evaluation_id uuid references public.evaluations(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  score numeric(5,2) not null,
  feedback text,
  graded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check ((evaluation_id is not null and task_id is null) or (evaluation_id is null and task_id is not null))
);

-- =============================================
-- TABLA RELACIONAL: Padres-Estudiantes
-- =============================================
create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  parent_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  relationship_type text default 'guardian',
  created_at timestamptz default now(),
  unique (parent_id, student_id)
);

-- =============================================
-- TABLA OPCIONAL: Certificados
-- =============================================
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  student_id uuid references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  template jsonb,
  qr_code text,
  signed_by uuid references public.profiles(id),
  issued_at timestamptz default now()
);

-- =============================================
-- TABLA OPCIONAL: Notificaciones
-- =============================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text check (type in ('system','academic','info')) not null default 'info',
  is_read boolean default false,
  created_at timestamptz default now()
);

-- =============================================
-- TABLAS DEL SISTEMA DE EVALUACIONES
-- =============================================

-- Tabla: Preguntas de evaluación
create table public.evaluation_questions (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  question_text text not null,
  question_type text check (question_type in ('multiple_choice','true_false','essay','short_answer')) not null default 'multiple_choice',
  options jsonb, -- Para opciones múltiples: [{"id": "a", "text": "Opción A"}, {"id": "b", "text": "Opción B"}]
  correct_answer text, -- Para multiple_choice: "a", para true_false: "true"/"false", para essay: null
  points numeric(5,2) not null default 1.00,
  explanation text, -- Explicación de la respuesta correcta
  order_index integer not null default 1,
  is_required boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabla: Respuestas de estudiantes
create table public.student_answers (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  question_id uuid not null references public.evaluation_questions(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  answer_text text, -- Respuesta del estudiante
  is_correct boolean, -- null para preguntas tipo essay que requieren calificación manual
  points_earned numeric(5,2) default 0.00,
  feedback text, -- Retroalimentación del profesor
  answered_at timestamptz default now(),
  graded_at timestamptz,
  graded_by uuid references auth.users(id) on delete set null,
  unique(evaluation_id, question_id, student_id)
);

-- Tabla: Intentos de evaluación
create table public.evaluation_attempts (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  attempt_number integer not null default 1,
  started_at timestamptz default now(),
  submitted_at timestamptz,
  total_score numeric(5,2) default 0.00,
  max_possible_score numeric(5,2) default 0.00,
  percentage numeric(5,2) default 0.00,
  status text check (status in ('in_progress','submitted','graded','expired')) default 'in_progress',
  time_spent_minutes integer default 0,
  unique(evaluation_id, student_id, attempt_number)
);

-- Tabla: Plantillas de certificados
create table public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  template_data jsonb not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- TABLAS DE ROLES Y AUDITORÍA
-- =============================================
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_system boolean default false,
  created_at timestamptz default now()
);

-- =============================================
-- TABLA MEMBERSHIPS: Modelo multi-tenant moderno
-- =============================================
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text check (role in ('owner','admin','teacher','student','parent','viewer')) not null default 'student',
  permissions jsonb default '{}', -- Permisos específicos adicionales
  is_active boolean default true,
  joined_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, tenant_id) -- Un usuario puede tener solo una membresía por tenant
);

-- Tabla legacy de user_roles (se mantiene por compatibilidad)
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_at timestamptz default now(),
  primary key (user_id, role_id)
);

create table if not exists public.audit_log (
  id bigserial primary key,
  created_at timestamptz default now(),
  user_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_values jsonb,
  new_values jsonb
);

-- =============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =============================================

-- Índices para evaluations
create index if not exists idx_evaluations_tenant_id on public.evaluations(tenant_id);
create index if not exists idx_evaluations_course_id on public.evaluations(course_id);

-- Índices para memberships (modelo multi-tenant)
create index if not exists idx_memberships_user_id on public.memberships(user_id);
create index if not exists idx_memberships_tenant_id on public.memberships(tenant_id);
create index if not exists idx_memberships_user_tenant on public.memberships(user_id, tenant_id);
create index if not exists idx_memberships_active on public.memberships(is_active) where is_active = true;
create index if not exists idx_evaluations_instructor_id on public.evaluations(instructor_id);

-- Índices para evaluation_questions
create index if not exists idx_evaluation_questions_evaluation_id on public.evaluation_questions(evaluation_id);
create index if not exists idx_evaluation_questions_order on public.evaluation_questions(evaluation_id, order_index);

-- Índices para student_answers
create index if not exists idx_student_answers_evaluation_student on public.student_answers(evaluation_id, student_id);
create index if not exists idx_student_answers_question on public.student_answers(question_id);

-- Índices para evaluation_attempts
create index if not exists idx_evaluation_attempts_student on public.evaluation_attempts(student_id);
create index if not exists idx_evaluation_attempts_evaluation on public.evaluation_attempts(evaluation_id);

-- Índices para certificate_templates
create index if not exists idx_certificate_templates_tenant_id on public.certificate_templates(tenant_id);
create index if not exists idx_certificate_templates_active on public.certificate_templates(is_active);

-- =============================================
-- FUNCIONES Y TRIGGERS
-- =============================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers updated_at
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trg_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger trg_resources_updated_at
before update on public.resources
for each row execute function public.set_updated_at();

create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger trg_evaluations_updated_at
before update on public.evaluations
for each row execute function public.set_updated_at();

create trigger trg_grades_updated_at
before update on public.grades
for each row execute function public.set_updated_at();

create trigger trg_evaluation_questions_updated_at
before update on public.evaluation_questions
for each row execute function public.set_updated_at();

create trigger trg_certificate_templates_updated_at
before update on public.certificate_templates
for each row execute function public.set_updated_at();

-- =============================================
-- TRIGGER: Crear perfil automáticamente
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- Buckets de Storage
-- =============================================
insert into storage.buckets (id, name, public)
values ('media','media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents','documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('signatures','signatures', false)
on conflict (id) do nothing;
