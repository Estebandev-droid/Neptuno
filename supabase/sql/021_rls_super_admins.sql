-- Neptuno — Supabase SQL — 021 RLS para app_super_admins
set search_path = app, public;

alter table app.app_super_admins enable row level security;

-- Sólo Super Admin puede ver/modificar esta tabla (y el servicio postgres puede administrar seeds)
create policy super_admins_select on app.app_super_admins for select
using (app.is_super_admin());

create policy super_admins_modify on app.app_super_admins for all
using (app.is_super_admin()) with check (app.is_super_admin());