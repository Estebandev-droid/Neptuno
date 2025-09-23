-- =============================================
-- SCHEMA OPTIMIZADO PARA NEPTUNO (FINAL)
-- =============================================

-- Extensiones necesarias
-- Nota: gen_random_uuid() está disponible nativamente en PostgreSQL 13+
-- Solo necesitamos pgcrypto para funciones de hash adicionales si es requerido
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
  -- email eliminado: usar auth.users.email como fuente única de verdad
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
  max_score integer default 100, -- Cambiado a integer para scores enteros
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
  max_score integer default 100, -- Cambiado a integer para scores enteros
  is_published boolean default false,
  evaluation_type text check (evaluation_type in ('quiz','exam','project','assignment')) default 'quiz',
  duration_minutes integer default 60,
  instructions text,
  start_date timestamptz,
  end_date timestamptz,
  attempts_allowed integer default 1,
  show_results boolean default true,
  randomize_questions boolean default false,
  passing_score integer default 60, -- Cambiado a integer para scores enteros
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
  signed_by uuid references public.profiles(id) on delete set null, -- Preservar certificado si se elimina firmante
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
-- TABLA MEMBERSHIPS: Sistema unificado de roles por tenant
-- =============================================
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text check (role in ('owner','admin','teacher','student','parent','viewer')) not null default 'student',
  permissions jsonb default '{}', -- Permisos específicos adicionales por rol
  is_active boolean default true,
  joined_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, tenant_id) -- Un usuario puede tener solo una membresía por tenant
);

-- Nota: Se eliminaron las tablas 'roles' y 'user_roles' legacy
-- El sistema ahora usa únicamente 'memberships' con roles por tenant
-- Para roles globales (super_admin), usar profiles.role

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
declare
  v_tenant_id uuid;
  v_default_role text := 'student';
begin
  -- Obtener el tenant por defecto (demo.neptuno.edu)
  select id into v_tenant_id 
  from public.tenants 
  where domain = 'demo.neptuno.edu' 
  limit 1;
  
  -- Si no existe el tenant por defecto, usar el primer tenant disponible
  if v_tenant_id is null then
    select id into v_tenant_id 
    from public.tenants 
    where is_active = true 
    order by created_at asc 
    limit 1;
  end if;
  
  -- Crear el perfil del usuario
  insert into public.profiles (id, full_name, role, tenant_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', v_default_role),
    v_tenant_id
  );
  
  -- Crear la membresía automáticamente si hay un tenant disponible
  if v_tenant_id is not null then
    insert into public.memberships (user_id, tenant_id, role, is_active)
    values (
      new.id,
      v_tenant_id,
      coalesce(new.raw_user_meta_data->>'role', v_default_role),
      true
    )
    on conflict (user_id, tenant_id) do update set
      role = excluded.role,
      is_active = true,
      updated_at = now();
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- VISTA: Perfiles con email de auth.users
-- =============================================
create or replace view public.profiles_with_email as
select 
  p.id,
  p.tenant_id,
  au.email, -- Email desde auth.users como fuente única
  p.full_name,
  p.avatar_url,
  p.signature_url,
  p.role,
  p.is_active,
  p.created_at,
  p.updated_at
from public.profiles p
join auth.users au on p.id = au.id;

-- =============================================
-- FUNCIONALIDADES AVANZADAS - CLASES EN VIVO Y SESIONES
-- =============================================

-- Tabla: Clases en vivo programadas
create table public.live_classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  instructor_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  actual_start timestamptz,
  actual_end timestamptz,
  meeting_url text, -- URL de Zoom, Meet, etc.
  meeting_id text, -- ID de la reunión
  meeting_password text, -- Password de la reunión
  status text check (status in ('scheduled','live','ended','cancelled')) default 'scheduled',
  max_participants integer default 100,
  recording_url text, -- URL de la grabación
  recording_duration integer, -- Duración en minutos
  is_recorded boolean default true,
  attendance_required boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabla: Asistencia a clases en vivo
create table public.live_class_attendance (
  id uuid primary key default gen_random_uuid(),
  live_class_id uuid not null references public.live_classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  left_at timestamptz,
  duration_minutes integer default 0,
  participation_score numeric(3,2) default 0.00, -- 0-10 basado en participación
  was_present boolean default true,
  unique(live_class_id, student_id)
);

-- Tabla: Sesiones de estudio (breakout rooms, grupos pequeños)
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  live_class_id uuid references public.live_classes(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  facilitator_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  session_type text check (session_type in ('breakout','study_group','tutoring','office_hours')) default 'study_group',
  start_time timestamptz not null,
  end_time timestamptz not null,
  max_participants integer default 10,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabla: Participantes en sesiones de estudio
create table public.study_session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  participant_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  role text check (role in ('participant','moderator')) default 'participant',
  unique(session_id, participant_id)
);

-- =============================================
-- SISTEMA DE COMENTARIOS Y CHAT EN TIEMPO REAL
-- =============================================

-- Tabla: Comentarios en clases en vivo
create table public.live_class_comments (
  id uuid primary key default gen_random_uuid(),
  live_class_id uuid not null references public.live_classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_comment_id uuid references public.live_class_comments(id) on delete cascade,
  content text not null,
  comment_type text check (comment_type in ('question','answer','comment','poll_response')) default 'comment',
  is_highlighted boolean default false, -- Para destacar comentarios importantes
  is_answered boolean default false, -- Para preguntas
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  reactions jsonb default '{}', -- {"like": 5, "love": 2, "helpful": 3}
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabla: Chat de cursos (asíncrono)
create table public.course_discussions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.course_discussions(id) on delete cascade,
  title text, -- Solo para posts principales
  content text not null,
  discussion_type text check (discussion_type in ('general','question','announcement','resource_share')) default 'general',
  is_resolved boolean default false, -- Para preguntas
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  tags text[], -- Etiquetas para categorizar
  attachments jsonb default '[]', -- URLs de archivos adjuntos
  reactions jsonb default '{}',
  view_count integer default 0,
  is_pinned boolean default false,
  is_locked boolean default false, -- No se pueden agregar más respuestas
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabla: Mensajes directos entre usuarios
create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  message_type text check (message_type in ('text','file','image','voice')) default 'text',
  file_url text,
  file_name text,
  file_size integer,
  is_read boolean default false,
  read_at timestamptz,
  is_deleted_by_sender boolean default false,
  is_deleted_by_recipient boolean default false,
  created_at timestamptz default now()
);

-- =============================================
-- SISTEMA AVANZADO DE TAREAS Y ACTIVIDADES
-- =============================================

-- Mejoras a la tabla de tareas existente
alter table public.tasks add column if not exists task_type text check (task_type in ('assignment','project','quiz','discussion','peer_review','presentation')) default 'assignment';
alter table public.tasks add column if not exists instructions jsonb default '{}';
alter table public.tasks add column if not exists rubric jsonb default '{}';
alter table public.tasks add column if not exists allow_late_submission boolean default true;
alter table public.tasks add column if not exists late_penalty_percent numeric(5,2) default 10.00;
alter table public.tasks add column if not exists group_task boolean default false;
alter table public.tasks add column if not exists max_group_size integer default 1;
alter table public.tasks add column if not exists submission_format text check (submission_format in ('text','file','url','video','audio')) default 'text';
alter table public.tasks add column if not exists estimated_duration_minutes integer default 60;
alter table public.tasks add column if not exists difficulty_level text check (difficulty_level in ('beginner','intermediate','advanced')) default 'intermediate';
alter table public.tasks add column if not exists learning_objectives text[];
alter table public.tasks add column if not exists resources jsonb default '[]';

-- Tabla: Grupos para tareas colaborativas
create table public.task_groups (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  name text not null,
  description text,
  max_members integer default 4,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Tabla: Miembros de grupos de tareas
create table public.task_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.task_groups(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  role text check (role in ('leader','member')) default 'member',
  joined_at timestamptz default now(),
  unique(group_id, student_id)
);

-- Tabla: Revisiones entre pares
create table public.peer_reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  review_content text,
  rating numeric(3,2), -- 1-10
  criteria_scores jsonb default '{}', -- Puntuaciones por criterio
  is_anonymous boolean default true,
  submitted_at timestamptz default now(),
  unique(task_id, reviewer_id, reviewee_id)
);

-- Tabla: Progreso de tareas (tracking detallado)
create table public.task_progress (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status text check (status in ('not_started','in_progress','submitted','graded','returned')) default 'not_started',
  progress_percentage numeric(5,2) default 0.00,
  time_spent_minutes integer default 0,
  last_activity timestamptz default now(),
  notes text, -- Notas del estudiante
  milestones_completed text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(task_id, student_id)
);

-- =============================================
-- SISTEMA DE ANALÍTICAS DE APRENDIZAJE
-- =============================================

-- Tabla: Métricas de engagement por estudiante
create table public.student_engagement_metrics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  date date not null default current_date,
  login_count integer default 0,
  total_time_minutes integer default 0,
  resources_accessed integer default 0,
  assignments_submitted integer default 0,
  discussions_participated integer default 0,
  live_classes_attended integer default 0,
  quiz_attempts integer default 0,
  average_quiz_score numeric(5,2),
  engagement_score numeric(5,2) default 0.00, -- Calculado automáticamente
  created_at timestamptz default now(),
  unique(student_id, course_id, date)
);

-- Tabla: Patrones de aprendizaje
create table public.learning_patterns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  learning_style text check (learning_style in ('visual','auditory','kinesthetic','reading_writing')) default 'visual',
  preferred_study_time text check (preferred_study_time in ('morning','afternoon','evening','night')) default 'evening',
  average_session_duration integer default 45, -- minutos
  completion_rate numeric(5,2) default 0.00,
  procrastination_tendency numeric(3,2) default 5.00, -- 1-10
  help_seeking_frequency numeric(3,2) default 5.00, -- 1-10
  collaboration_preference numeric(3,2) default 5.00, -- 1-10
  difficulty_areas text[] default '{}',
  strength_areas text[] default '{}',
  last_updated timestamptz default now(),
  unique(student_id, course_id)
);

-- Tabla: Alertas de riesgo académico
create table public.academic_risk_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  risk_type text check (risk_type in ('low_engagement','poor_performance','attendance_issues','late_submissions','no_participation')) not null,
  risk_level text check (risk_level in ('low','medium','high','critical')) default 'medium',
  description text not null,
  suggested_actions text[],
  is_resolved boolean default false,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz default now()
);

-- Tabla: Reportes de progreso automatizados
create table public.progress_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  report_type text check (report_type in ('weekly','monthly','midterm','final')) not null,
  report_period_start date not null,
  report_period_end date not null,
  overall_grade numeric(5,2),
  attendance_rate numeric(5,2),
  engagement_score numeric(5,2),
  assignments_completed integer default 0,
  assignments_total integer default 0,
  strengths text[],
  areas_for_improvement text[],
  recommendations text[],
  parent_notified boolean default false,
  parent_notified_at timestamptz,
  generated_at timestamptz default now()
);

-- =============================================
-- SISTEMA DE GAMIFICACIÓN
-- =============================================

-- Tabla: Logros y badges
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  badge_icon text, -- URL del ícono
  badge_color text default '#FFD700',
  category text check (category in ('academic','participation','collaboration','creativity','leadership')) default 'academic',
  points_value integer default 10,
  criteria jsonb not null, -- Criterios para obtener el logro
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Tabla: Logros obtenidos por estudiantes
create table public.student_achievements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  earned_at timestamptz default now(),
  points_earned integer default 0,
  unique(student_id, achievement_id, course_id)
);

-- Tabla: Sistema de puntos y ranking
create table public.student_points (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  total_points integer default 0,
  level_name text default 'Novice',
  level_number integer default 1,
  points_to_next_level integer default 100,
  streak_days integer default 0, -- Días consecutivos de actividad
  last_activity_date date default current_date,
  rank_in_course integer,
  rank_in_tenant integer,
  updated_at timestamptz default now(),
  unique(student_id, course_id)
);

-- =============================================
-- ÍNDICES PARA OPTIMIZACIÓN DE FUNCIONALIDADES AVANZADAS
-- =============================================

-- Índices para clases en vivo
create index if not exists idx_live_classes_tenant_course on public.live_classes(tenant_id, course_id);
create index if not exists idx_live_classes_instructor on public.live_classes(instructor_id);
create index if not exists idx_live_classes_scheduled_start on public.live_classes(scheduled_start);
create index if not exists idx_live_classes_status on public.live_classes(status);

-- Índices para asistencia
create index if not exists idx_live_class_attendance_class_student on public.live_class_attendance(live_class_id, student_id);
create index if not exists idx_live_class_attendance_student on public.live_class_attendance(student_id);

-- Índices para comentarios
create index if not exists idx_live_class_comments_class on public.live_class_comments(live_class_id);
create index if not exists idx_live_class_comments_user on public.live_class_comments(user_id);
create index if not exists idx_live_class_comments_parent on public.live_class_comments(parent_comment_id);
create index if not exists idx_live_class_comments_created on public.live_class_comments(created_at desc);

-- Índices para discusiones
create index if not exists idx_course_discussions_course on public.course_discussions(course_id);
create index if not exists idx_course_discussions_user on public.course_discussions(user_id);
create index if not exists idx_course_discussions_parent on public.course_discussions(parent_id);
create index if not exists idx_course_discussions_type on public.course_discussions(discussion_type);
create index if not exists idx_course_discussions_created on public.course_discussions(created_at desc);

-- Índices para mensajes directos
create index if not exists idx_direct_messages_sender on public.direct_messages(sender_id);
create index if not exists idx_direct_messages_recipient on public.direct_messages(recipient_id);
create index if not exists idx_direct_messages_conversation on public.direct_messages(sender_id, recipient_id, created_at);
create index if not exists idx_direct_messages_unread on public.direct_messages(recipient_id, is_read) where is_read = false;

-- Índices para tareas y progreso
create index if not exists idx_task_progress_student_task on public.task_progress(student_id, task_id);
create index if not exists idx_task_progress_status on public.task_progress(status);
create index if not exists idx_task_progress_last_activity on public.task_progress(last_activity desc);

-- Índices para analíticas
create index if not exists idx_student_engagement_student_course on public.student_engagement_metrics(student_id, course_id);
create index if not exists idx_student_engagement_date on public.student_engagement_metrics(date desc);
create index if not exists idx_learning_patterns_student on public.learning_patterns(student_id);
create index if not exists idx_academic_risk_alerts_student on public.academic_risk_alerts(student_id);
create index if not exists idx_academic_risk_alerts_unresolved on public.academic_risk_alerts(is_resolved) where is_resolved = false;

-- Índices para gamificación
create index if not exists idx_student_achievements_student on public.student_achievements(student_id);
create index if not exists idx_student_achievements_achievement on public.student_achievements(achievement_id);
create index if not exists idx_student_points_course_rank on public.student_points(course_id, rank_in_course);
create index if not exists idx_student_points_tenant_rank on public.student_points(tenant_id, rank_in_tenant);

-- =============================================
-- TRIGGERS PARA FUNCIONALIDADES AUTOMÁTICAS AVANZADAS
-- =============================================

-- Trigger para actualizar updated_at en las nuevas tablas
create trigger trg_live_classes_updated_at
before update on public.live_classes
for each row execute function public.set_updated_at();

create trigger trg_study_sessions_updated_at
before update on public.study_sessions
for each row execute function public.set_updated_at();

create trigger trg_live_class_comments_updated_at
before update on public.live_class_comments
for each row execute function public.set_updated_at();

create trigger trg_course_discussions_updated_at
before update on public.course_discussions
for each row execute function public.set_updated_at();

create trigger trg_task_progress_updated_at
before update on public.task_progress
for each row execute function public.set_updated_at();

create trigger trg_student_points_updated_at
before update on public.student_points
for each row execute function public.set_updated_at();

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
