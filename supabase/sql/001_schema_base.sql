-- Neptuno — Supabase SQL — 001 Schema Base
-- Workspace: no-vcs-local | Fecha: 2025-09-04

-- Extensiones necesarias
create extension if not exists pgcrypto;

-- Esquema lógico de la app
create schema if not exists app;

-- Roles de aplicación
create type app.app_role as enum ('Owner','Admin','Inventario','Ventas','Auditor');

-- Empresas (tenants)
create table if not exists app.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  created_by uuid
);

-- Membresías usuario↔tenant con rol
create table if not exists app.memberships (
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  user_id uuid not null,
  role app.app_role not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists memberships_user_idx on app.memberships(user_id);

-- Invitaciones
create table if not exists app.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references app.tenants(id) on delete cascade,
  email text not null,
  role app.app_role not null,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REVOKED')),
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists invitations_tenant_idx on app.invitations(tenant_id);
create index if not exists invitations_email_idx on app.invitations((lower(email)));

-- Auditoría
create table if not exists app.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  tenant_id uuid,
  table_name text not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  row_id text,
  old_data jsonb,
  new_data jsonb
);
create index if not exists audit_tenant_at_idx on app.audit_log(tenant_id, at);

-- Super Admins (bypass RLS controlado)
create table if not exists app.app_super_admins (
  user_id uuid primary key,
  created_at timestamptz not null default now(),
  created_by uuid
);

-- Privilegios base (RLS aplicará sobre esto)
grant usage on schema app to authenticated;
grant select, insert, update, delete on all tables in schema app to authenticated;
-- Nota: no concedemos a anon por ahora (catálogo público vendrá luego con vistas/endpoints específicos)