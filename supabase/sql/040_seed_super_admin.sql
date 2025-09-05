-- Neptuno — Supabase SQL — 040 Seed Super Admin (PO)
-- Opción seleccionada: por UID (desde captura de pantalla de Auth)
-- Usuario: esteban@gmail.com | UID: 20ca37f3-8310-4a63-ae8c-9d09cc759079
-- Ejecuta este script una sola vez.

-- (B) Seed por UID — listo para ejecutar
insert into app.app_super_admins(user_id)
values ('20ca37f3-8310-4a63-ae8c-9d09cc759079'::uuid)
on conflict (user_id) do nothing;

    -- Agregar también por email como alternativa
insert into app.app_super_admins(user_id)
select id from auth.users where lower(email) = lower('esteban@gmail.com')
on conflict (user_id) do nothing;

-- Verificaciones rápidas
-- 1) Confirmar que quedó registrado como Super Admin:
--    select * from app.app_super_admins;
--    select app.is_super_admin('20ca37f3-8310-4a63-ae8c-9d09cc759079'::uuid);
-- 2) Si está logueado y ejecuta como ese usuario desde el cliente:
--    select app.is_super_admin();

-- (A) Alternativa por EMAIL (NO usada). Si desea usarla en el futuro, descomente y ajuste:
-- insert into app.app_super_admins(user_id)
-- select id from auth.users where lower(email) = lower('esteban@gmail.com')
-- on conflict (user_id) do nothing;