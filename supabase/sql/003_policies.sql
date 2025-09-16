-- =============================================
-- 004_policies.sql
-- RLS (Row-Level Security) para Neptuno optimizado
-- =============================================

begin;

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
        'certificates','notifications','roles','user_roles'
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
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.memberships enable row level security;

-- ==========================================================
-- 3. HELPERS DE ROLES Y ADMIN
-- ==========================================================
create or replace function public.get_role(p_user uuid default auth.uid())
returns text language sql stable security definer set search_path = public as $$
  select min(r.name)
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user
$$;

create or replace function public.is_platform_admin(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.platform_admins pa where pa.user_id = p_user
    union
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user and r.name in ('platform_admin','superadmin')
  )
$$;

create or replace function public.has_role(p_role_name text, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user and r.name = p_role_name
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

-- Roles y User Roles
create policy roles_select on public.roles
for select using (is_platform_admin());
create policy user_roles_select on public.user_roles
for select using (auth.uid() = user_id or is_platform_admin());
create policy user_roles_write on public.user_roles
for all using (is_platform_admin())
with check (is_platform_admin());

commit;
