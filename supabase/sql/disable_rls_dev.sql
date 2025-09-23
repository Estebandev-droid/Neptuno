-- =============================================
-- SCRIPT PARA DESHABILITAR RLS EN DESARROLLO
-- =============================================
-- ADVERTENCIA: Solo usar en entorno de desarrollo
-- NO ejecutar en producción
-- =============================================

begin;

-- Verificar que estamos en desarrollo
do $$
begin
  if current_setting('app.environment', true) = 'production' then
    raise exception 'PELIGRO: No se puede deshabilitar RLS en producción';
  end if;
end $$;

-- Mensaje de advertencia
select 'ADVERTENCIA: Deshabilitando RLS para desarrollo - NO usar en producción' as warning;

-- Deshabilitar RLS en todas las tablas principales
alter table public.tenants disable row level security;
alter table public.profiles disable row level security;
alter table public.platform_admins disable row level security;
-- alter table public.roles disable row level security; -- Tabla eliminada, ahora se usa memberships
-- alter table public.user_roles disable row level security; -- Tabla eliminada, ahora se usa memberships
alter table public.memberships disable row level security;
alter table public.courses disable row level security;
-- alter table public.lessons disable row level security; -- Tabla no existe en esquema actual
alter table public.resources disable row level security;
alter table public.evaluations disable row level security;
-- alter table public.questions disable row level security; -- Tabla no existe en esquema actual
alter table public.student_answers disable row level security;
alter table public.evaluation_attempts disable row level security;
alter table public.grades disable row level security;
alter table public.relationships disable row level security;
alter table public.certificates disable row level security;
alter table public.notifications disable row level security;
alter table public.audit_log disable row level security;

-- Deshabilitar RLS en storage (comentado - requiere permisos especiales)
-- alter table storage.objects disable row level security; -- Requiere permisos de propietario
-- alter table storage.buckets disable row level security; -- Requiere permisos de propietario

-- Crear función temporal para habilitar RLS nuevamente
create or replace function public.enable_rls_all_tables()
returns text
language plpgsql
security definer
as $$
begin
  -- Habilitar RLS en todas las tablas principales
  alter table public.tenants enable row level security;
  alter table public.profiles enable row level security;
  alter table public.platform_admins enable row level security;
  -- alter table public.roles enable row level security; -- Tabla eliminada, ahora se usa memberships
  -- alter table public.user_roles enable row level security; -- Tabla eliminada, ahora se usa memberships
  alter table public.memberships enable row level security;
  alter table public.courses enable row level security;
  -- alter table public.lessons enable row level security; -- Tabla no existe en esquema actual
  alter table public.resources enable row level security;
  alter table public.evaluations enable row level security;
  -- alter table public.questions enable row level security; -- Tabla no existe en esquema actual
  alter table public.student_answers enable row level security;
  alter table public.evaluation_attempts enable row level security;
  alter table public.grades enable row level security;
  alter table public.relationships enable row level security;
  alter table public.certificates enable row level security;
  alter table public.notifications enable row level security;
  alter table public.audit_log enable row level security;
  
  -- Habilitar RLS en storage (comentado - requiere permisos especiales)
  -- alter table storage.objects enable row level security; -- Requiere permisos de propietario
  -- alter table storage.buckets enable row level security; -- Requiere permisos de propietario
  
  return 'RLS habilitado en todas las tablas';
end;
$$;

-- Mensaje de confirmación
select 'RLS deshabilitado para desarrollo. Para rehabilitar ejecuta: SELECT public.enable_rls_all_tables();' as info;

commit;

-- =============================================
-- INSTRUCCIONES DE USO:
-- =============================================
-- 1. Para deshabilitar RLS: \i disable_rls_dev.sql
-- 2. Para rehabilitar RLS: SELECT public.enable_rls_all_tables();
-- 3. NUNCA usar en producción
-- =============================================