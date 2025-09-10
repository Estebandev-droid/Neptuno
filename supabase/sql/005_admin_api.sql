-- 005_admin_api.sql
-- API administrativa para manejo de roles y usuarios desde la aplicación
-- Incluye CRUD de roles y asignación de roles a usuarios de manera segura
-- Requiere tablas public.roles(id uuid PK, name text UNIQUE, created_at timestamptz)
-- y public.user_roles(user_id uuid, role_id uuid, unique(user_id, role_id))

begin;

-- Garantizar tablas base (idempotente)
create extension if not exists "uuid-ossp";

create table if not exists public.roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_roles_pkey primary key (user_id, role_id)
);

-- Funciones helpers
create or replace function public.is_platform_admin(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.platform_admins pa where pa.user_id = p_user)
      or exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p_user and r.name = 'platform_admin');
$$;

-- CRUD de roles
create or replace function public.role_create(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; begin
  insert into public.roles(name) values (p_name)
  on conflict (name) do update set name = excluded.name
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.role_delete(p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.roles where name = p_name;
end; $$;

create or replace function public.role_rename(p_old_name text, p_new_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.roles set name = p_new_name where name = p_old_name;
end; $$;

-- Asignación de roles a usuarios
create or replace function public.user_role_assign(p_user uuid, p_role_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_role_id uuid; begin
  select id into v_role_id from public.roles where name = p_role_name;
  if v_role_id is null then
    raise exception 'role % not found', p_role_name;
  end if;
  insert into public.user_roles(user_id, role_id) values (p_user, v_role_id)
  on conflict do nothing;
end; $$;

create or replace function public.user_role_revoke(p_user uuid, p_role_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_role_id uuid; begin
  select id into v_role_id from public.roles where name = p_role_name;
  if v_role_id is not null then
    delete from public.user_roles where user_id = p_user and role_id = v_role_id;
  end if;
end; $$;

-- Lectura utilitaria de roles por usuario
create or replace function public.user_roles_list(p_user uuid)
returns table(role_name text) language sql stable security definer set search_path = public as $$
  select r.name from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p_user order by r.name;
$$;

-- Función helper para verificar roles específicos
create or replace function public.has_role(p_role_name text, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.user_roles ur 
    join public.roles r on r.id = ur.role_id 
    where ur.user_id = p_user and r.name = p_role_name
  );
$$;

-- Función mejorada para crear usuario de desarrollo (sin confirmación de email)
create or replace function public.create_dev_user(
  p_email text,
  p_password text default 'password123',
  p_full_name text default null,
  p_role_name text default 'student',
  p_phone text default null,
  p_signature_url text default null,
  p_photo_url text default null
)
returns json
security definer
set search_path = public
language plpgsql
as $$
declare
  v_user_id uuid;
  v_role_id uuid;
  v_result json;
begin
  -- Verificar que el usuario actual sea admin o superadmin
  if not (is_platform_admin() or has_role('superadmin')) then
    return json_build_object('success', false, 'error', 'No tienes permisos para crear usuarios');
  end if;

  -- Obtener el ID del rol
  select id into v_role_id from public.roles where name = p_role_name;
  if v_role_id is null then
    return json_build_object('success', false, 'error', 'Rol no encontrado: ' || p_role_name);
  end if;

  -- Crear usuario en auth.users (simulando registro sin confirmación)
  insert into auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data
  ) values (
    gen_random_uuid(),
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    json_build_object('full_name', coalesce(p_full_name, split_part(p_email, '@', 1)))
  ) returning id into v_user_id;

  -- Crear perfil con campos opcionales
  insert into public.profiles (id, full_name, phone, signature_url, photo_url)
  values (v_user_id, coalesce(p_full_name, split_part(p_email, '@', 1)), p_phone, p_signature_url, p_photo_url);

  -- Asignar rol
  insert into public.user_roles (user_id, role_id)
  values (v_user_id, v_role_id);

  v_result := json_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', p_email,
    'role', p_role_name,
    'full_name', coalesce(p_full_name, split_part(p_email, '@', 1))
  );

  return v_result;

exception
  when unique_violation then
    return json_build_object('success', false, 'error', 'El email ya está registrado');
  when others then
    return json_build_object('success', false, 'error', 'Error interno: ' || SQLERRM);
end;
$$;

commit;