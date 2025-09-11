-- =============================================
-- 005_admin_api.sql
-- Funciones RPC para administración (DEV) y utilidades de roles/usuarios
-- Nota: Estas funciones están pensadas para desarrollo. En producción, agregar validaciones de permisos.
-- =============================================

begin;

set search_path = public;

-- ==========================================================
-- Helpers de roles (duplicados aquí para entorno DEV)
-- ==========================================================
create or replace function public.get_role(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select min(r.name)
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user
$$;

create or replace function public.is_platform_admin(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.platform_admins pa where pa.user_id = p_user
    union
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user and r.name in ('platform_admin','superadmin')
  )
$$;

create or replace function public.has_role(p_role_name text, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user and r.name = p_role_name
  )
$$;

-- ==========================================================
-- Gestión de roles
-- ==========================================================
create or replace function public.role_create(p_name text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.roles(name, description)
  values (trim(p_name), p_description)
  on conflict (name) do update set description = coalesce(excluded.description, public.roles.description)
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.role_rename(p_old_name text, p_new_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.roles
  set name = trim(p_new_name)
  where name = trim(p_old_name) and coalesce(is_system, false) = false;
  return found;
end; $$;

create or replace function public.role_delete(p_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.roles
  where name = trim(p_name) and coalesce(is_system, false) = false;
  return found;
end; $$;

-- ==========================================================
-- Asignación de roles a usuarios
-- ==========================================================
create or replace function public.user_role_assign(p_user uuid, p_role_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_role_id uuid;
begin
  select id into v_role_id from public.roles where name = trim(p_role_name);
  if v_role_id is null then
    raise exception 'Rol % no existe', p_role_name using errcode = 'P0001';
  end if;
  insert into public.user_roles(user_id, role_id)
  values (p_user, v_role_id)
  on conflict (user_id, role_id) do nothing;
end; $$;

create or replace function public.user_role_revoke(p_user uuid, p_role_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_roles ur
  using public.roles r
  where ur.user_id = p_user and ur.role_id = r.id and r.name = trim(p_role_name);
  return found;
end; $$;

create or replace function public.user_roles_list(p_user uuid)
returns table(role_name text)
language sql
security definer
set search_path = public
as $$
  select r.name as role_name
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user
  order by r.name
$$;

-- ==========================================================
-- Utilidades DEV para crear/eliminar perfiles (NO crea usuarios de auth)
-- ==========================================================
-- create_dev_user: asume que el usuario ya existe en auth.users (creado vía supabase.auth.signUp en el frontend)
-- Aseguramos compatibilidad de tipo de retorno: si existe con distinto tipo, lo eliminamos primero
DROP FUNCTION IF EXISTS public.create_dev_user(text, text, text, text, text, text, text);

create or replace function public.create_dev_user(
  p_email text,
  p_password text default null, -- ignorado: solo para compatibilidad de interfaz
  p_full_name text default null,
  p_role_name text default 'student',
  p_phone text default null,
  p_signature_url text default null,
  p_photo_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role_id uuid;
  v_role text := trim(coalesce(p_role_name, 'student'));
begin
  -- Buscar usuario por email de forma segura (evita error si esquema auth no existe)
  begin
    execute format('select id from %I.%I where lower(email) = lower($1)', 'auth','users')
    into v_user_id
    using p_email;
  exception when undefined_table or invalid_schema_name then
    return jsonb_build_object('success', false, 'error', 'Esquema/tablas de autenticación no disponibles (auth.users). Asegúrate de estar en un proyecto Supabase con Auth habilitado.');
  end;

  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Usuario de auth no existe. Primero realiza signUp desde el cliente.');
  end if;

  -- Upsert de perfil
  insert into public.profiles(id, email, full_name, avatar_url, signature_url, is_active)
  values (v_user_id, p_email, coalesce(p_full_name, split_part(p_email,'@',1)), p_photo_url, p_signature_url, true)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    signature_url = excluded.signature_url,
    is_active = true,
    updated_at = now();

  -- Asignar rol si existe
  select id into v_role_id from public.roles where name = v_role;
  if v_role_id is not null then
    insert into public.user_roles(user_id, role_id)
    values (v_user_id, v_role_id)
    on conflict (user_id, role_id) do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', p_email,
    'full_name', coalesce(p_full_name, split_part(p_email,'@',1)),
    'message', 'Perfil creado/actualizado y rol asignado'
  );
end; $$;

-- Eliminar datos de perfil del usuario (DEV)
DROP FUNCTION IF EXISTS public.delete_dev_user(uuid);
create or replace function public.delete_dev_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Quitar roles
  delete from public.user_roles where user_id = p_user_id;
  -- Eliminar perfil
  delete from public.profiles where id = p_user_id;
  return jsonb_build_object('success', true, 'message', 'Roles y perfil eliminados (auth.users NO fue eliminado)');
end; $$;

-- ==========================================================
-- Grants para que el cliente pueda invocar estas funciones
-- ==========================================================
DO $$
BEGIN
  EXECUTE 'grant execute on function public.get_role(uuid) to anon, authenticated';
  EXECUTE 'grant execute on function public.is_platform_admin(uuid) to anon, authenticated';
  EXECUTE 'grant execute on function public.has_role(text, uuid) to anon, authenticated';
  EXECUTE 'grant execute on function public.role_create(text, text) to anon, authenticated';
  EXECUTE 'grant execute on function public.role_rename(text, text) to anon, authenticated';
  EXECUTE 'grant execute on function public.role_delete(text) to anon, authenticated';
  EXECUTE 'grant execute on function public.user_role_assign(uuid, text) to anon, authenticated';
  EXECUTE 'grant execute on function public.user_role_revoke(uuid, text) to anon, authenticated';
  EXECUTE 'grant execute on function public.user_roles_list(uuid) to anon, authenticated';
  EXECUTE 'grant execute on function public.create_dev_user(text, text, text, text, text, text, text) to anon, authenticated';
  EXECUTE 'grant execute on function public.delete_dev_user(uuid) to anon, authenticated';
EXCEPTION WHEN others THEN
  -- Ignorar errores de duplicado en grants para idempotencia
  NULL;
END $$;

commit;