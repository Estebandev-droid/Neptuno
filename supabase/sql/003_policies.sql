-- =============================================
-- 003_policies.sql
-- Políticas de seguridad RLS (Row Level Security)
-- Incluye configuraciones para desarrollo y producción
-- =============================================

BEGIN;

-- =============================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- =============================================

-- Habilitar RLS solo en tablas que existen
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
-- Tablas 'roles' y 'user_roles' eliminadas - ahora se usa 'memberships'
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 1. LIMPIEZA DE POLÍTICAS EXISTENTES PARA IDPOTENCIA
-- ==========================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','platform_admins','categories','courses','enrollments',
        'resources','tasks','submissions','evaluations','grades','relationships',
        'certificates','notifications','memberships'
      )
  LOOP
    EXECUTE format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ==========================================================
-- 2. ACTIVAR RLS EN TABLAS DEL ESQUEMA
-- ==========================================================
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.categories enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.resources enable row level security;
alter table public.tasks enable row level security;
alter table public.submissions enable row level security;
alter table public.evaluations enable row level security;
alter table public.grades enable row level security;
alter table public.relationships enable row level security;
alter table public.certificates enable row level security;
alter table public.notifications enable row level security;
-- Tablas 'roles' y 'user_roles' eliminadas - RLS manejado por 'memberships'
alter table public.memberships enable row level security;

-- ==========================================================
-- 3. HELPERS DE ROLES Y ADMIN
-- ==========================================================
create or replace function public.get_role(p_user uuid default auth.uid())
returns text language sql stable security definer set search_path = public as $$
  -- Primero verificar rol global en profiles
  select coalesce(
    (select role from public.profiles where id = p_user),
    (select role from public.memberships where user_id = p_user and is_active = true limit 1),
    'student'
  )
$$;

create or replace function public.is_platform_admin(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.platform_admins pa where pa.user_id = p_user
    union
    select 1 from public.profiles p where p.id = p_user and p.role in ('super_admin','platform_admin')
  )
$$;

create or replace function public.has_role(p_role_name text, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    -- Verificar rol global en profiles
    select 1 from public.profiles p where p.id = p_user and p.role = p_role_name
    union
    -- Verificar rol por tenant en memberships
    select 1 from public.memberships m where m.user_id = p_user and m.role = p_role_name and m.is_active = true
  )
$$;

-- =============================================
-- FUNCIONES HELPER PARA MEMBERSHIPS
-- =============================================
create or replace function public.has_membership_role(p_tenant_id uuid, p_role_name text, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.memberships m
    where m.user_id = p_user 
      and m.tenant_id = p_tenant_id 
      and m.role = p_role_name 
      and m.is_active = true
  )
$$;

drop function if exists public.get_user_tenants(uuid);
create or replace function public.get_user_tenants(p_user uuid default auth.uid())
returns table(tenant_id uuid, role text) language sql stable security definer set search_path = public as $$
  select m.tenant_id, m.role
  from public.memberships m
  where m.user_id = p_user and m.is_active = true
$$;

create or replace function public.is_tenant_member(p_tenant_id uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.memberships m
    where m.user_id = p_user 
      and m.tenant_id = p_tenant_id 
      and m.is_active = true
  )
$$;

-- ==========================================================
-- 4. POLÍTICAS DE ACCESO
-- ==========================================================

-- Perfiles: cada quien su propio perfil; admins pueden ver todos
create policy profiles_select on public.profiles
for select using (auth.uid() = id or is_platform_admin());
create policy profiles_update on public.profiles
for update using (auth.uid() = id or is_platform_admin());
create policy profiles_insert on public.profiles
for insert with check (auth.uid() = id or is_platform_admin());

-- Platform Admins: visible solo para superadmin / platform_admin
create policy platform_admins_select on public.platform_admins
for select using (is_platform_admin());

-- Categorías: todos pueden leer; solo admins y teachers escriben
create policy categories_select on public.categories
for select using (true);
create policy categories_write on public.categories
for all using (is_platform_admin() or has_role('tenant_admin') or has_role('teacher'))
with check (is_platform_admin() or has_role('tenant_admin') or has_role('teacher'));

-- Cursos
create policy courses_select on public.courses
for select using (true);
create policy courses_write on public.courses
for all using (is_platform_admin() or has_role('tenant_admin') or has_role('teacher'))
with check (is_platform_admin() or has_role('tenant_admin') or has_role('teacher'));

-- Inscripciones
create policy enrollments_select on public.enrollments
for select using (auth.uid() = student_id or is_platform_admin() or has_role('teacher'));
create policy enrollments_write on public.enrollments
for all using (is_platform_admin() or has_role('teacher'))
with check (is_platform_admin() or has_role('teacher'));

-- Recursos
create policy resources_select on public.resources
for select using (is_public = true or is_platform_admin() or has_role('teacher'));
create policy resources_write on public.resources
for all using (is_platform_admin() or has_role('teacher'))
with check (is_platform_admin() or has_role('teacher'));

-- Tareas
create policy tasks_select on public.tasks
for select using (true);
create policy tasks_write on public.tasks
for all using (is_platform_admin() or has_role('teacher'))
with check (is_platform_admin() or has_role('teacher'));

-- Entregas
create policy submissions_select on public.submissions
for select using (auth.uid() = student_id or is_platform_admin() or has_role('teacher'));
create policy submissions_write on public.submissions
for all using (auth.uid() = student_id or is_platform_admin() or has_role('teacher'))
with check (auth.uid() = student_id or is_platform_admin() or has_role('teacher'));

-- Memberships: usuarios pueden ver sus propias membresías; admins pueden ver todas
create policy memberships_select on public.memberships
for select using (auth.uid() = user_id or is_platform_admin());
create policy memberships_insert on public.memberships
for insert with check (is_platform_admin() or has_membership_role(tenant_id, 'owner', auth.uid()) or has_membership_role(tenant_id, 'admin', auth.uid()));
create policy memberships_update on public.memberships
for update using (is_platform_admin() or has_membership_role(tenant_id, 'owner', auth.uid()) or has_membership_role(tenant_id, 'admin', auth.uid()));
create policy memberships_delete on public.memberships
for delete using (is_platform_admin() or has_membership_role(tenant_id, 'owner', auth.uid()));

-- Evaluaciones
create policy evaluations_select on public.evaluations
for select using (true);
create policy evaluations_write on public.evaluations
for all using (is_platform_admin() or has_role('teacher'))
with check (is_platform_admin() or has_role('teacher'));

-- =============================================
-- Evaluación: Preguntas, Respuestas y Intentos
-- =============================================

-- evaluation_questions: estudiantes inscritos pueden ver; solo admin/teacher escriben
create policy evaluation_questions_select on public.evaluation_questions
for select using (
  is_platform_admin() or has_role('teacher') or
  exists (
    select 1 from public.evaluations e
    join public.enrollments en on en.course_id = e.course_id
    where e.id = evaluation_id
      and en.student_id = auth.uid()
      and en.status = 'active'
  )
);

create policy evaluation_questions_write on public.evaluation_questions
for all using (is_platform_admin() or has_role('teacher'))
with check (is_platform_admin() or has_role('teacher'));

-- student_answers: el estudiante dueño puede leer/escribir; admin/teacher pueden leer y actualizar para calificar
create policy student_answers_select on public.student_answers
for select using (
  student_id = auth.uid() or is_platform_admin() or has_role('teacher')
);

create policy student_answers_insert on public.student_answers
for insert with check (
  student_id = auth.uid() or is_platform_admin() or has_role('teacher')
);

create policy student_answers_update on public.student_answers
for update using (
  student_id = auth.uid() or is_platform_admin() or has_role('teacher')
) with check (
  student_id = auth.uid() or is_platform_admin() or has_role('teacher')
);

create policy student_answers_delete on public.student_answers
for delete using (
  is_platform_admin() or has_role('teacher')
);

-- evaluation_attempts: el estudiante dueño puede leer/escribir; admin/teacher también
create policy evaluation_attempts_select on public.evaluation_attempts
for select using (
  student_id = auth.uid() or is_platform_admin() or has_role('teacher')
);

create policy evaluation_attempts_insert on public.evaluation_attempts
for insert with check (
  student_id = auth.uid() or is_platform_admin() or has_role('teacher')
);

create policy evaluation_attempts_update on public.evaluation_attempts
for update using (
  student_id = auth.uid() or is_platform_admin() or has_role('teacher')
) with check (
  student_id = auth.uid() or is_platform_admin() or has_role('teacher')
);

create policy evaluation_attempts_delete on public.evaluation_attempts
for delete using (
  is_platform_admin() or has_role('teacher')
);

-- Calificaciones
create policy grades_select on public.grades
for select using (auth.uid() = student_id or is_platform_admin() or has_role('teacher'));
create policy grades_write on public.grades
for all using (is_platform_admin() or has_role('teacher'))
with check (is_platform_admin() or has_role('teacher'));

-- Relaciones (padres/estudiantes)
create policy relationships_select on public.relationships
for select using (parent_id = auth.uid() or student_id = auth.uid() or is_platform_admin());
create policy relationships_write on public.relationships
for all using (is_platform_admin() or has_role('tenant_admin'))
with check (is_platform_admin() or has_role('tenant_admin'));

-- Certificados
create policy certificates_select on public.certificates
for select using (student_id = auth.uid() or is_platform_admin() or has_role('teacher'));
create policy certificates_write on public.certificates
for all using (is_platform_admin() or has_role('teacher'))
with check (is_platform_admin() or has_role('teacher'));

-- Notificaciones
create policy notifications_select on public.notifications
for select using (user_id = auth.uid() or is_platform_admin());
create policy notifications_write on public.notifications
for all using (user_id = auth.uid() or is_platform_admin())
with check (user_id = auth.uid() or is_platform_admin());

-- Memberships: reemplaza a roles y user_roles
-- Las políticas de memberships ya están definidas arriba

-- =============================================
-- POLÍTICAS ADICIONALES DE PRODUCCIÓN
-- =============================================

-- TENANTS: Solo admins pueden ver/modificar (políticas mejoradas)
DROP POLICY IF EXISTS "tenants_select_policy" ON public.tenants;
CREATE POLICY "tenants_select_policy" ON public.tenants
  FOR SELECT USING (
    public.is_platform_admin() OR 
    public.has_role('superadmin') OR
    public.has_role('developer')
  );

DROP POLICY IF EXISTS "tenants_insert_policy" ON public.tenants;
CREATE POLICY "tenants_insert_policy" ON public.tenants
  FOR INSERT WITH CHECK (
    public.is_platform_admin() OR 
    public.has_role('superadmin')
  );

DROP POLICY IF EXISTS "tenants_update_policy" ON public.tenants;
CREATE POLICY "tenants_update_policy" ON public.tenants
  FOR UPDATE USING (
    public.is_platform_admin() OR 
    public.has_role('superadmin')
  );

-- PROFILES: Políticas mejoradas para producción
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR
    public.is_platform_admin() OR 
    public.has_role('superadmin') OR
    public.has_role('developer') OR
    public.has_membership_role(tenant_id, 'admin') OR
    public.has_membership_role(tenant_id, 'owner') OR
    -- Teachers pueden ver perfiles de su mismo tenant
    (public.has_membership_role(tenant_id, 'teacher') OR public.has_role('teacher'))
  );

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid() OR
    public.is_platform_admin() OR 
    public.has_role('superadmin') OR
    public.has_role('developer')
  );

-- =============================================
-- POLÍTICAS RLS AVANZADAS
-- =============================================

-- =============================================
-- POLÍTICAS PARA CLASES EN VIVO
-- =============================================

-- Política para ver clases en vivo
create policy "Users can view live classes in their courses"
  on public.live_classes for select
  using (
    -- Instructores pueden ver sus clases
    instructor_id = auth.uid()
    or
    -- Estudiantes pueden ver clases de cursos donde están inscritos
    exists (
      select 1 from public.enrollments e
      where e.course_id = live_classes.course_id
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
    or
    -- Administradores del tenant pueden ver todas las clases
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('tenant_admin', 'super_admin')
    )
    or
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id = live_classes.tenant_id
        and m.role in ('admin', 'owner')
        and m.is_active = true
    )
  );

-- Política para crear/modificar clases en vivo
create policy "Instructors can manage their live classes"
  on public.live_classes for all
  using (
    instructor_id = auth.uid()
    or
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('tenant_admin', 'super_admin')
    )
    or
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id = live_classes.tenant_id
        and m.role in ('admin', 'owner')
        and m.is_active = true
    )
  )
  with check (
    instructor_id = auth.uid()
    or
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('tenant_admin', 'super_admin')
    )
    or
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id = live_classes.tenant_id
        and m.role in ('admin', 'owner')
        and m.is_active = true
    )
  );

-- Política para asistencia a clases en vivo
create policy "Students can manage their live class attendance"
  on public.live_class_attendance for all
  using (
    student_id = auth.uid()
    or
    -- Instructores pueden ver asistencia de sus clases
    exists (
      select 1 from public.live_classes lc
      where lc.id = live_class_attendance.live_class_id
        and lc.instructor_id = auth.uid()
    )
    or
    -- Administradores pueden ver toda la asistencia
    exists (
      select 1 from public.live_classes lc
      where lc.id = live_class_attendance.live_class_id
        and (
          exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('tenant_admin', 'super_admin')
          )
          or
          exists (
            select 1 from public.memberships m
            where m.user_id = auth.uid()
              and m.tenant_id = lc.tenant_id
              and m.role in ('admin', 'owner')
              and m.is_active = true
          )
        )
    )
  )
  with check (
    student_id = auth.uid()
  );

-- =============================================
-- POLÍTICAS PARA COMENTARIOS Y CHAT
-- =============================================

-- Política para comentarios en clases en vivo
create policy "Users can view comments in accessible live classes"
  on public.live_class_comments for select
  using (
    exists (
      select 1 from public.live_classes lc
      where lc.id = live_class_comments.live_class_id
        and (
          lc.instructor_id = auth.uid()
          or
          exists (
            select 1 from public.enrollments e
            where e.course_id = lc.course_id
              and e.student_id = auth.uid()
              and e.status = 'active'
          )
        )
    )
  );

create policy "Users can create comments in accessible live classes"
  on public.live_class_comments for insert
  with check (
    user_id = auth.uid()
    and
    exists (
      select 1 from public.live_classes lc
      where lc.id = live_class_comments.live_class_id
        and (
          lc.instructor_id = auth.uid()
          or
          exists (
            select 1 from public.enrollments e
            where e.course_id = lc.course_id
              and e.student_id = auth.uid()
              and e.status = 'active'
          )
        )
    )
  );

create policy "Users can update their own comments"
  on public.live_class_comments for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own comments or instructors can moderate"
  on public.live_class_comments for delete
  using (
    user_id = auth.uid()
    or
    exists (
      select 1 from public.live_classes lc
      where lc.id = live_class_comments.live_class_id
        and lc.instructor_id = auth.uid()
    )
  );

-- Política para discusiones de curso
create policy "Users can view discussions in their courses"
  on public.course_discussions for select
  using (
    exists (
      select 1 from public.enrollments e
      where e.course_id = course_discussions.course_id
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
    or
    exists (
      select 1 from public.courses c
      where c.id = course_discussions.course_id
        and c.instructor_id = auth.uid()
    )
  );

create policy "Enrolled users can create discussions"
  on public.course_discussions for insert
  with check (
    user_id = auth.uid()
    and
    (
      exists (
        select 1 from public.enrollments e
        where e.course_id = course_discussions.course_id
          and e.student_id = auth.uid()
          and e.status = 'active'
      )
      or
      exists (
        select 1 from public.courses c
        where c.id = course_discussions.course_id
          and c.instructor_id = auth.uid()
      )
    )
  );

-- Política para mensajes directos
create policy "Users can view their direct messages"
  on public.direct_messages for select
  using (
    sender_id = auth.uid() or recipient_id = auth.uid()
  );

create policy "Users can send direct messages"
  on public.direct_messages for insert
  with check (
    sender_id = auth.uid()
    and
    -- Verificar que ambos usuarios pertenezcan al mismo tenant
    exists (
      select 1 from public.memberships m1
      join public.memberships m2 on m1.tenant_id = m2.tenant_id
      where m1.user_id = sender_id
        and m2.user_id = recipient_id
        and m1.tenant_id = direct_messages.tenant_id
        and m1.is_active = true
        and m2.is_active = true
    )
  );

create policy "Users can update read status of their messages"
  on public.direct_messages for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- =============================================
-- POLÍTICAS PARA TAREAS AVANZADAS
-- =============================================

-- Política para progreso de tareas
create policy "Students can view and update their task progress"
  on public.task_progress for all
  using (
    student_id = auth.uid()
    or
    -- Instructores pueden ver progreso de sus estudiantes
    exists (
      select 1 from public.tasks t
      join public.courses c on c.id = t.course_id
      where t.id = task_progress.task_id
        and c.instructor_id = auth.uid()
    )
    or
    -- Padres pueden ver progreso de sus hijos
    exists (
      select 1 from public.relationships r
      where r.student_id = task_progress.student_id
        and r.parent_id = auth.uid()
    )
  )
  with check (
    student_id = auth.uid()
  );

-- Política para grupos de tareas
create policy "Students can view task groups for their tasks"
  on public.task_groups for select
  using (
    exists (
      select 1 from public.tasks t
      join public.enrollments e on e.course_id = t.course_id
      where t.id = task_groups.task_id
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
    or
    exists (
      select 1 from public.tasks t
      join public.courses c on c.id = t.course_id
      where t.id = task_groups.task_id
        and c.instructor_id = auth.uid()
    )
  );

create policy "Students can create groups for group tasks"
  on public.task_groups for insert
  with check (
    exists (
      select 1 from public.tasks t
      join public.enrollments e on e.course_id = t.course_id
      where t.id = task_groups.task_id
        and e.student_id = auth.uid()
        and e.status = 'active'
        and t.group_task = true
    )
  );

-- Política para miembros de grupos de tareas
create policy "Group members can view their group membership"
  on public.task_group_members for select
  using (
    student_id = auth.uid()
    or
    exists (
      select 1 from public.task_groups tg
      join public.tasks t on t.id = tg.task_id
      join public.courses c on c.id = t.course_id
      where tg.id = task_group_members.group_id
        and c.instructor_id = auth.uid()
    )
  );

create policy "Students can join groups and leaders can manage members"
  on public.task_group_members for all
  using (
    student_id = auth.uid()
    or
    exists (
      select 1 from public.task_group_members tgm
      where tgm.group_id = task_group_members.group_id
        and tgm.student_id = auth.uid()
        and tgm.role = 'leader'
    )
  )
  with check (
    student_id = auth.uid()
    or
    exists (
      select 1 from public.task_group_members tgm
      where tgm.group_id = task_group_members.group_id
        and tgm.student_id = auth.uid()
        and tgm.role = 'leader'
    )
  );

-- =============================================
-- POLÍTICAS PARA ANALÍTICAS Y MÉTRICAS
-- =============================================

-- Política para métricas de engagement
create policy "Users can view relevant engagement metrics"
  on public.student_engagement_metrics for select
  using (
    student_id = auth.uid()
    or
    -- Instructores pueden ver métricas de sus estudiantes
    exists (
      select 1 from public.courses c
      where c.id = student_engagement_metrics.course_id
        and c.instructor_id = auth.uid()
    )
    or
    -- Padres pueden ver métricas de sus hijos
    exists (
      select 1 from public.relationships r
      where r.student_id = student_engagement_metrics.student_id
        and r.parent_id = auth.uid()
    )
    or
    -- Administradores pueden ver todas las métricas de su tenant
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('tenant_admin', 'super_admin')
    )
    or
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id = student_engagement_metrics.tenant_id
        and m.role in ('admin', 'owner')
        and m.is_active = true
    )
  );

-- Política para alertas de riesgo académico
create policy "Relevant users can view academic risk alerts"
  on public.academic_risk_alerts for select
  using (
    student_id = auth.uid()
    or
    -- Instructores pueden ver alertas de sus estudiantes
    exists (
      select 1 from public.courses c
      where c.id = academic_risk_alerts.course_id
        and c.instructor_id = auth.uid()
    )
    or
    -- Padres pueden ver alertas de sus hijos
    exists (
      select 1 from public.relationships r
      where r.student_id = academic_risk_alerts.student_id
        and r.parent_id = auth.uid()
    )
    or
    -- Administradores pueden ver todas las alertas
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('tenant_admin', 'super_admin')
    )
    or
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id = academic_risk_alerts.tenant_id
        and m.role in ('admin', 'owner')
        and m.is_active = true
    )
  );

create policy "Instructors and admins can create risk alerts"
  on public.academic_risk_alerts for insert
  with check (
    exists (
      select 1 from public.courses c
      where c.id = academic_risk_alerts.course_id
        and c.instructor_id = auth.uid()
    )
    or
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('tenant_admin', 'super_admin')
    )
    or
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id = academic_risk_alerts.tenant_id
        and m.role in ('admin', 'owner')
        and m.is_active = true
    )
  );

create policy "Instructors and admins can update risk alerts"
  on public.academic_risk_alerts for update
  using (
    exists (
      select 1 from public.courses c
      where c.id = academic_risk_alerts.course_id
        and c.instructor_id = auth.uid()
    )
    or
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('tenant_admin', 'super_admin')
    )
    or
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id = academic_risk_alerts.tenant_id
        and m.role in ('admin', 'owner')
        and m.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = academic_risk_alerts.course_id
        and c.instructor_id = auth.uid()
    )
    or
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id = academic_risk_alerts.tenant_id
        and m.role in ('admin', 'owner')
        and m.is_active = true
    )
  );

-- =============================================
-- POLÍTICAS PARA GAMIFICACIÓN
-- =============================================

-- Política para logros
create policy "Users can view achievements in their tenant"
  on public.achievements for select
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id = achievements.tenant_id
        and m.is_active = true
    )
  );

-- Política para logros de estudiantes
create policy "Users can view relevant student achievements"
  on public.student_achievements for select
  using (
    student_id = auth.uid()
    or
    -- Instructores pueden ver logros de sus estudiantes
    exists (
      select 1 from public.courses c
      where c.id = student_achievements.course_id
        and c.instructor_id = auth.uid()
    )
    or
    -- Padres pueden ver logros de sus hijos
    exists (
      select 1 from public.relationships r
      where r.student_id = student_achievements.student_id
        and r.parent_id = auth.uid()
    )
    or
    -- Compañeros de clase pueden ver logros públicos
    exists (
      select 1 from public.enrollments e1
      join public.enrollments e2 on e1.course_id = e2.course_id
      join public.achievements a on a.id = student_achievements.achievement_id
      where e1.student_id = auth.uid()
        and e2.student_id = student_achievements.student_id
        and e1.status = 'active'
        and e2.status = 'active'
        and a.is_active = true
    )
  );

-- Política para puntos de estudiantes
create policy "Users can view relevant student points"
  on public.student_points for select
  using (
    student_id = auth.uid()
    or
    -- Instructores pueden ver puntos de sus estudiantes
    exists (
      select 1 from public.courses c
      where c.id = student_points.course_id
        and c.instructor_id = auth.uid()
    )
    or
    -- Padres pueden ver puntos de sus hijos
    exists (
      select 1 from public.relationships r
      where r.student_id = student_points.student_id
        and r.parent_id = auth.uid()
    )
    or
    -- Compañeros pueden ver rankings públicos
    exists (
      select 1 from public.enrollments e1
      join public.enrollments e2 on e1.course_id = e2.course_id
      where e1.student_id = auth.uid()
        and e2.student_id = student_points.student_id
        and e1.status = 'active'
        and e2.status = 'active'
    )
  );

-- =============================================
-- POLÍTICAS PARA SESIONES DE ESTUDIO
-- =============================================

-- Política para sesiones de estudio
create policy "Users can view study sessions in their courses"
  on public.study_sessions for select
  using (
    facilitator_id = auth.uid()
    or
    exists (
      select 1 from public.enrollments e
      where e.course_id = study_sessions.course_id
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
    or
    exists (
      select 1 from public.courses c
      where c.id = study_sessions.course_id
        and c.instructor_id = auth.uid()
    )
  );

create policy "Enrolled users can create study sessions"
  on public.study_sessions for insert
  with check (
    facilitator_id = auth.uid()
    and
    (
      exists (
        select 1 from public.enrollments e
        where e.course_id = study_sessions.course_id
          and e.student_id = auth.uid()
          and e.status = 'active'
      )
      or
      exists (
        select 1 from public.courses c
        where c.id = study_sessions.course_id
          and c.instructor_id = auth.uid()
      )
    )
  );

-- Política para participantes de sesiones de estudio
create policy "Users can view study session participants"
  on public.study_session_participants for select
  using (
    participant_id = auth.uid()
    or
    exists (
      select 1 from public.study_sessions ss
      where ss.id = study_session_participants.session_id
        and ss.facilitator_id = auth.uid()
    )
  );

create policy "Students can join study sessions"
  on public.study_session_participants for insert
  with check (
    participant_id = auth.uid()
    and
    exists (
      select 1 from public.study_sessions ss
      join public.enrollments e on e.course_id = ss.course_id
      where ss.id = study_session_participants.session_id
        and e.student_id = auth.uid()
        and e.status = 'active'
        and ss.is_active = true
    )
  );

-- =============================================
-- HABILITAR RLS EN TODAS LAS NUEVAS TABLAS
-- =============================================

alter table public.live_classes enable row level security;
alter table public.live_class_attendance enable row level security;
alter table public.live_class_comments enable row level security;
alter table public.course_discussions enable row level security;
alter table public.direct_messages enable row level security;
alter table public.task_progress enable row level security;
alter table public.task_groups enable row level security;
alter table public.task_group_members enable row level security;
alter table public.student_engagement_metrics enable row level security;
alter table public.academic_risk_alerts enable row level security;
alter table public.achievements enable row level security;
alter table public.student_achievements enable row level security;
alter table public.student_points enable row level security;
alter table public.study_sessions enable row level security;
alter table public.study_session_participants enable row level security;

-- =============================================
-- VERIFICACIÓN DE RLS
-- =============================================

-- Función para verificar que todas las tablas tengan RLS habilitado
DO $$
DECLARE
  rec RECORD;
  tables_without_rls TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR rec IN 
    SELECT schemaname, tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
  LOOP
    IF NOT (
      SELECT relrowsecurity 
      FROM pg_class 
      WHERE relname = rec.tablename 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = rec.schemaname)
    ) THEN
      tables_without_rls := array_append(tables_without_rls, rec.schemaname || '.' || rec.tablename);
    END IF;
  END LOOP;
  
  IF array_length(tables_without_rls, 1) > 0 THEN
    RAISE WARNING 'Las siguientes tablas NO tienen RLS habilitado: %', array_to_string(tables_without_rls, ', ');
  ELSE
    RAISE NOTICE 'Todas las tablas públicas tienen RLS habilitado correctamente.';
  END IF;
END $$;

commit;
