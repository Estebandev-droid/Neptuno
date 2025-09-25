-- =============================================
-- 006_roles.sql — Roles personalizables por tenant y endpoint support
-- =============================================

-- Tabla de roles por tenant (roles del sistema usan tenant_id NULL e is_system = true)
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table public.roles enable row level security;

-- Políticas RLS para roles
-- Lectura: cualquiera con membresía puede leer roles de su tenant; admins de plataforma leen todo;
--          roles del sistema (tenant_id is null, is_system=true) son visibles por cualquier usuario autenticado.
drop policy if exists "roles_select" on public.roles;
create policy "roles_select" on public.roles
  for select using (
    public.is_platform_admin()
    or (tenant_id is null and is_system = true)
    or exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id = public.roles.tenant_id
        and m.is_active = true
    )
  );

-- Inserción: platform admins pueden crear roles de sistema (tenant_id null);
--            owners/admins pueden crear roles para su tenant
drop policy if exists "roles_insert" on public.roles;
create policy "roles_insert" on public.roles
  for insert with check (
    (tenant_id is null and is_system = true and public.is_platform_admin())
    or (
      tenant_id is not null
      and is_system = false
      and (public.has_membership_role(tenant_id, 'owner') or public.has_membership_role(tenant_id, 'admin'))
    )
  );

-- Update: mismas reglas que insert
drop policy if exists "roles_update" on public.roles;
create policy "roles_update" on public.roles
  for update using (
    public.is_platform_admin()
    or (
      tenant_id is not null
      and (public.has_membership_role(tenant_id, 'owner') or public.has_membership_role(tenant_id, 'admin'))
    )
  ) with check (
    public.is_platform_admin()
    or (
      tenant_id is not null
      and is_system = false
      and (public.has_membership_role(tenant_id, 'owner') or public.has_membership_role(tenant_id, 'admin'))
    )
  );

-- Delete: platform admins cualquier rol; owners solo de su tenant si no están en uso
drop policy if exists "roles_delete" on public.roles;
create policy "roles_delete" on public.roles
  for delete using (
    public.is_platform_admin()
    or (
      tenant_id is not null
      and (public.has_membership_role(tenant_id, 'owner') or public.has_membership_role(tenant_id, 'admin'))
    )
  );

-- =============================================
-- RPCs para CRUD de roles por tenant
-- =============================================

-- Crear rol para tenant o del sistema
create or replace function public.role_create(
  p_tenant_id uuid,
  p_name text,
  p_description text default null,
  p_is_system boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_is_system then
    if not public.is_platform_admin() then
      raise exception 'Solo platform admins pueden crear roles del sistema';
    end if;
  else
    if p_tenant_id is null then
      raise exception 'p_tenant_id requerido para roles no-sistema';
    end if;
    if not (public.has_membership_role(p_tenant_id, 'owner') or public.has_membership_role(p_tenant_id, 'admin')) then
      raise exception 'Permisos insuficientes para crear roles en el tenant %', p_tenant_id;
    end if;
  end if;

  insert into public.roles(id, tenant_id, name, description, is_system)
  values (gen_random_uuid(), case when p_is_system then null else p_tenant_id end, p_name, p_description, p_is_system)
  returning id into v_id;

  return v_id;
end;
$$;

-- Renombrar rol
create or replace function public.role_rename(
  p_role_id uuid,
  p_new_name text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_is_system boolean;
begin
  select tenant_id, is_system into v_tenant_id, v_is_system from public.roles where id = p_role_id;
  if not found then
    raise exception 'Rol no encontrado';
  end if;

  if v_is_system then
    if not public.is_platform_admin() then
      raise exception 'Solo platform admins pueden renombrar roles del sistema';
    end if;
  else
    if not (public.has_membership_role(v_tenant_id, 'owner') or public.has_membership_role(v_tenant_id, 'admin')) then
      raise exception 'Permisos insuficientes para renombrar roles en el tenant %', v_tenant_id;
    end if;
  end if;

  update public.roles set name = p_new_name where id = p_role_id;
end;
$$;

-- Eliminar rol (si no está en uso)
create or replace function public.role_delete(
  p_role_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_is_system boolean;
  v_role_name text;
  v_in_use boolean;
begin
  select tenant_id, is_system, name into v_tenant_id, v_is_system, v_role_name from public.roles where id = p_role_id;
  if not found then
    raise exception 'Rol no encontrado';
  end if;

  if v_is_system then
    if not public.is_platform_admin() then
      raise exception 'Solo platform admins pueden eliminar roles del sistema';
    end if;
  else
    if not (public.has_membership_role(v_tenant_id, 'owner') or public.has_membership_role(v_tenant_id, 'admin')) then
      raise exception 'Permisos insuficientes para eliminar roles en el tenant %', v_tenant_id;
    end if;
  end if;

  -- validar uso en memberships
  select exists(
    select 1 from public.memberships m
    where m.tenant_id = coalesce(v_tenant_id, m.tenant_id)
      and m.role = v_role_name
      and m.is_active = true
  ) into v_in_use;

  if v_in_use then
    raise exception 'No se puede eliminar el rol %, está en uso por memberships activas', v_role_name;
  end if;

  delete from public.roles where id = p_role_id;
end;
$$;

-- Listar roles por tenant + roles del sistema
create or replace function public.list_tenant_roles(
  p_tenant_id uuid default null
) returns table(role_name text, description text, is_system boolean, usage_count bigint)
language sql
security definer
set search_path = public
as $$
  select r.name as role_name,
         r.description,
         r.is_system,
         (
           select count(m.id)
           from public.memberships m
           where m.role = r.name
             and (r.tenant_id is null or m.tenant_id = r.tenant_id)
             and m.is_active = true
         )::bigint as usage_count
  from public.roles r
  where (p_tenant_id is null and r.is_system = true) or (r.tenant_id = p_tenant_id)
  order by r.is_system desc, r.name asc;
$$;

-- =============================================
-- PERMISOS GRANT EXECUTE PARA FUNCIONES DE ROLES
-- =============================================

GRANT EXECUTE ON FUNCTION public.role_create(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.role_rename(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.role_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tenant_roles(uuid) TO authenticated;