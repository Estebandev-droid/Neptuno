-- =============================================
-- TABLA: Certificate Templates
-- =============================================
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

-- Índices para mejorar el rendimiento
create index idx_certificate_templates_tenant_id on public.certificate_templates(tenant_id);
create index idx_certificate_templates_active on public.certificate_templates(is_active);

-- Trigger para actualizar updated_at
create trigger set_certificate_templates_updated_at
  before update on public.certificate_templates
  for each row execute function public.set_updated_at();

-- RLS (Row Level Security)
alter table public.certificate_templates enable row level security;

-- Política para que los usuarios solo vean templates de su tenant
create policy "Users can view certificate templates from their tenant" on public.certificate_templates
  for select using (
    tenant_id = (
      select tenant_id from public.profiles 
      where id = auth.uid()
    )
  );

-- Política para que solo administradores puedan crear/modificar templates
create policy "Only admins can manage certificate templates" on public.certificate_templates
  for all using (
    exists (
      select 1 from public.profiles p
      join public.user_roles ur on p.id = ur.user_id
      join public.roles r on ur.role_id = r.id
      where p.id = auth.uid()
        and r.name in ('admin', 'super_admin')
        and p.tenant_id = certificate_templates.tenant_id
    )
  );

-- Función RPC para obtener templates de certificados
create or replace function get_certificate_templates(
  p_tenant_id uuid default null,
  p_is_active boolean default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  tenant_id uuid,
  name text,
  description text,
  template_data jsonb,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    ct.id,
    ct.tenant_id,
    ct.name,
    ct.description,
    ct.template_data,
    ct.is_active,
    ct.created_at,
    ct.updated_at
  from public.certificate_templates ct
  where (p_tenant_id is null or ct.tenant_id = p_tenant_id)
    and (p_is_active is null or ct.is_active = p_is_active)
  order by ct.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

-- Función RPC para crear template de certificado
create or replace function create_certificate_template(
  p_tenant_id uuid,
  p_name text,
  p_description text,
  p_template_data jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  template_id uuid;
begin
  insert into public.certificate_templates (
    tenant_id,
    name,
    description,
    template_data
  ) values (
    p_tenant_id,
    p_name,
    p_description,
    p_template_data
  ) returning id into template_id;
  
  return template_id;
end;
$$;

-- Función RPC para actualizar template de certificado
create or replace function update_certificate_template(
  p_template_id uuid,
  p_name text default null,
  p_description text default null,
  p_template_data jsonb default null,
  p_is_active boolean default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  updated_count integer;
begin
  update public.certificate_templates
  set 
    name = coalesce(p_name, name),
    description = coalesce(p_description, description),
    template_data = coalesce(p_template_data, template_data),
    is_active = coalesce(p_is_active, is_active),
    updated_at = now()
  where id = p_template_id;
  
  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

-- Función RPC para eliminar template de certificado
create or replace function delete_certificate_template(
  p_template_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from public.certificate_templates
  where id = p_template_id;
  
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;