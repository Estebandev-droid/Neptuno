-- Neptuno — Supabase SQL — 010 Functions & RPC
set search_path = app, public;

-- Helpers
create or replace function app.current_user_id() returns uuid
language sql stable as $$
  select auth.uid();
$$;

create or replace function app.is_super_admin(u uuid default auth.uid()) returns boolean
language sql stable as $$
  select exists (select 1 from app.app_super_admins s where s.user_id = u);
$$;

create or replace function app.user_in_tenant(u uuid, t uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from app.memberships m where m.user_id = u and m.tenant_id = t
  );
$$;

create or replace function app.user_has_role(u uuid, t uuid, roles app.app_role[])
returns boolean language sql stable as $$
  select exists (
    select 1 from app.memberships m
    where m.user_id = u and m.tenant_id = t and m.role = any(roles)
  );
$$;

-- API: crear tenant y bootstrap Owner
create or replace function app.api_create_tenant(p_name text, p_slug text)
returns uuid
language plpgsql security definer set search_path = app, public as $$
declare
  v_tenant uuid;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'auth.uid() is null; requiere usuario autenticado';
  end if;
  if char_length(p_name) < 2 or char_length(p_name) > 100 then
    raise exception 'Nombre inválido (2..100)';
  end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Slug inválido (kebab-case)';
  end if;

  insert into app.tenants(name, slug, created_by)
  values (p_name, lower(p_slug), v_uid)
  returning id into v_tenant;

  insert into app.memberships(tenant_id, user_id, role)
  values (v_tenant, v_uid, 'Owner'::app.app_role)
  on conflict do nothing;

  insert into app.audit_log(actor_id, tenant_id, table_name, action, row_id, new_data)
  values (v_uid, v_tenant, 'app.tenants', 'INSERT', v_tenant::text,
          jsonb_build_object('name', p_name, 'slug', lower(p_slug)));

  return v_tenant;
end
$$;

-- API: añadir Super Admin por email (sólo Super Admin puede invocar)
create or replace function app.api_add_super_admin_by_email(p_email text)
returns void
language plpgsql security definer set search_path = app, public as $$
declare
  v_uid uuid;
  v_caller uuid;
begin
  v_caller := auth.uid();
  if v_caller is null then
    raise exception 'Requiere autenticación';
  end if;
  if not app.is_super_admin(v_caller) then
    raise exception 'Sólo Super Admin puede otorgar Super Admin';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(p_email) limit 1;
  if v_uid is null then
    raise exception 'Usuario con email % no existe en auth.users', p_email;
  end if;

  insert into app.app_super_admins(user_id, created_by)
  values (v_uid, v_caller)
  on conflict (user_id) do nothing;
end
$$;

-- Grants para funciones RPC
grant execute on function app.current_user_id() to authenticated;
grant execute on function app.is_super_admin(uuid) to authenticated;
grant execute on function app.user_in_tenant(uuid, uuid) to authenticated;
grant execute on function app.user_has_role(uuid, uuid, app.app_role[]) to authenticated;
grant execute on function app.api_create_tenant(text, text) to authenticated;
grant execute on function app.api_add_super_admin_by_email(text) to authenticated;