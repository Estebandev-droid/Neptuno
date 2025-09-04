-- Neptuno — Supabase SQL — 020 RLS Policies
set search_path = app, public;

-- Habilitar RLS
alter table app.tenants enable row level security;
alter table app.memberships enable row level security;
alter table app.invitations enable row level security;
alter table app.audit_log enable row level security;

-- Tenants
create policy tenants_select on app.tenants for select
using (
  app.is_super_admin() or app.user_in_tenant(auth.uid(), id)
);

create policy tenants_update on app.tenants for update
using (
  app.is_super_admin() or app.user_has_role(auth.uid(), id, array['Owner','Admin']::app.app_role[])
) with check (
  app.is_super_admin() or app.user_has_role(auth.uid(), id, array['Owner','Admin']::app.app_role[])
);

create policy tenants_insert on app.tenants for insert
with check (app.is_super_admin());

create policy tenants_delete on app.tenants for delete
using (app.is_super_admin());

-- Memberships
create policy memberships_select on app.memberships for select
using (
  app.is_super_admin()
  or user_id = auth.uid()
  or app.user_has_role(auth.uid(), tenant_id, array['Owner','Admin']::app.app_role[])
);

create policy memberships_modify on app.memberships for all
using (
  app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, array['Owner','Admin']::app.app_role[])
) with check (
  app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, array['Owner','Admin']::app.app_role[])
);

-- Invitations
create policy invitations_select on app.invitations for select
using (
  app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, array['Owner','Admin']::app.app_role[])
);

create policy invitations_modify on app.invitations for all
using (
  app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, array['Owner','Admin']::app.app_role[])
) with check (
  app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, array['Owner','Admin']::app.app_role[])
);

-- Audit log: sólo lectura para super admin o dueños/admin; insert abierto para triggers
create policy audit_select on app.audit_log for select
using (
  app.is_super_admin() or app.user_has_role(auth.uid(), tenant_id, array['Owner','Admin']::app.app_role[])
);

create policy audit_insert_any on app.audit_log for insert
with check (true);