-- Neptuno — Supabase SQL — 015 Public Views
-- Expone las tablas del esquema app como vistas en el esquema public

-- Vista para tenants
create or replace view public.tenants as
select id, name, slug, created_at, created_by
from app.tenants;

-- Vista para categories
create or replace view public.categories as
select id, tenant_id, parent_id, name, attributes, created_at, updated_at
from app.categories;

-- Vista para memberships (para verificar permisos)
create or replace view public.memberships as
select tenant_id, user_id, role, created_at
from app.memberships;

-- Permisos para las vistas
grant select on public.tenants to authenticated;
grant select on public.categories to authenticated;
grant select on public.memberships to authenticated;

-- Permisos de inserción/actualización/eliminación para categories
grant insert, update, delete on public.categories to authenticated;

-- Función RPC para obtener tenants del usuario actual
create or replace function public.get_user_tenants()
returns table(id uuid, name text, slug text, role app.app_role)
language sql security definer
set search_path = app, public
as $$
  select t.id, t.name, t.slug, m.role
  from app.tenants t
  join app.memberships m on t.id = m.tenant_id
  where m.user_id = auth.uid()
  order by t.name;
$$;

grant execute on function public.get_user_tenants() to authenticated;

-- Función RPC para obtener categories de un tenant
create or replace function public.get_tenant_categories(tenant_id uuid, search_term text default '')
returns table(id uuid, tenant_id uuid, parent_id uuid, name text, attributes jsonb, created_at timestamptz, updated_at timestamptz)
language sql security definer
set search_path = app, public
as $$
  select c.id, c.tenant_id, c.parent_id, c.name, c.attributes, c.created_at, c.updated_at
  from app.categories c
  where c.tenant_id = get_tenant_categories.tenant_id
    and (search_term = '' or c.name ilike '%' || search_term || '%')
  order by c.name;
$$;

grant execute on function public.get_tenant_categories(uuid, text) to authenticated;