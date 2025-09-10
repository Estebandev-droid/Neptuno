-- 000_reset_policies.sql
-- Limpia (elimina) todas las políticas RLS de las tablas del esquema public
-- y, opcionalmente, las políticas en storage.objects si el rol actual es owner.
-- No borra tablas ni datos. Úsalo para dejar la BD lista y volver a aplicar 004_policies.sql.

begin;

-- Eliminar todas las políticas en el esquema public
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END
$do$ LANGUAGE plpgsql;

-- Eliminar políticas en storage.objects si el rol actual es owner
DO $do$
DECLARE v_is_owner boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND pg_get_userbyid(c.relowner) = current_user
  ) INTO v_is_owner;

  IF v_is_owner THEN
    EXECUTE 'drop policy if exists "Public read media" on storage.objects';
    EXECUTE 'drop policy if exists "Authenticated write media" on storage.objects';
    EXECUTE 'drop policy if exists "Admin update media" on storage.objects';
    EXECUTE 'drop policy if exists "Admin delete media" on storage.objects';
    EXECUTE 'drop policy if exists "Certificates read/write restricted" on storage.objects';
  ELSE
    RAISE NOTICE 'Omitiendo limpieza de storage.objects: el rol actual (%) no es owner', current_user;
  END IF;
END
$do$ LANGUAGE plpgsql;

commit;

-- Verificación manual (opcional):
-- select schemaname, tablename, polname from pg_policies where schemaname in ('public','storage') order by 1,2,3;