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

-- Deshabilitar RLS en todas las tablas públicas existentes (excepto storage.* por permisos)
do $$
declare
  rec record;
begin
  for rec in 
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not like 'pg_%'
  loop
    execute format('alter table %I.%I disable row level security', rec.schemaname, rec.tablename);
  end loop;
end $$;

-- Deshabilitar RLS en storage (comentado - requiere permisos especiales)
-- alter table storage.objects disable row level security; -- Requiere permisos de propietario
-- alter table storage.buckets disable row level security; -- Requiere permisos de propietario

-- Crear función temporal para habilitar RLS nuevamente
create or replace function public.enable_rls_all_tables()
returns text
language plpgsql
security definer
as $$
declare
  rec record;
begin
  -- Habilitar RLS en todas las tablas públicas existentes (excepto storage.* por permisos)
  for rec in 
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not like 'pg_%'
  loop
    execute format('alter table %I.%I enable row level security', rec.schemaname, rec.tablename);
  end loop;
  
  -- Habilitar RLS en storage (comentado - requiere permisos especiales)
  -- alter table storage.objects enable row level security; -- Requiere permisos de propietario
  -- alter table storage.buckets enable row level security; -- Requiere permisos de propietario
  
  return 'RLS habilitado en todas las tablas públicas';
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