-- Neptuno — Supabase SQL — 030 Audit Trigger
set search_path = app, public;

create or replace function app.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_actor uuid;
  v_tenant uuid;
  v_table text;
  v_row_id text;
begin
  v_actor := auth.uid();
  v_table := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;

  if TG_OP = 'INSERT' then
    v_tenant := nullif(coalesce((to_jsonb(NEW)->>'tenant_id'), ''), '')::uuid;
    v_row_id := (to_jsonb(NEW)->>'id');
    insert into app.audit_log(actor_id, tenant_id, table_name, action, row_id, new_data)
    values (v_actor, v_tenant, v_table, 'INSERT', v_row_id, to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    v_tenant := nullif(coalesce((to_jsonb(NEW)->>'tenant_id'), (to_jsonb(OLD)->>'tenant_id'), ''), '')::uuid;
    v_row_id := coalesce((to_jsonb(NEW)->>'id'), (to_jsonb(OLD)->>'id'));
    insert into app.audit_log(actor_id, tenant_id, table_name, action, row_id, old_data, new_data)
    values (v_actor, v_tenant, v_table, 'UPDATE', v_row_id, to_jsonb(OLD), to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'DELETE' then
    v_tenant := nullif((to_jsonb(OLD)->>'tenant_id'), '')::uuid;
    v_row_id := (to_jsonb(OLD)->>'id');
    insert into app.audit_log(actor_id, tenant_id, table_name, action, row_id, old_data)
    values (v_actor, v_tenant, v_table, 'DELETE', v_row_id, to_jsonb(OLD));
    return OLD;
  end if;
  return null;
end
$$;

-- Adjuntar a tablas críticas
create trigger tenants_audit
after insert or update or delete on app.tenants
for each row execute function app.tg_audit();

create trigger memberships_audit
after insert or update or delete on app.memberships
for each row execute function app.tg_audit();

create trigger invitations_audit
after insert or update or delete on app.invitations
for each row execute function app.tg_audit();