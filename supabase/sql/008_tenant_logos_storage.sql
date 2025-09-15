-- Migración: Configuración de Storage para logos de tenants
-- Crea bucket de Storage `tenant-logos` y políticas necesarias (idempotente)

DO $$
BEGIN

-- 1) Crear bucket si no existe (público para lectura)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

-- 2) Crear políticas de acceso (solo si no existen)

--    a) Lectura pública (anon y authenticated) SOLO para este bucket
IF NOT EXISTS (
  SELECT 1 FROM pg_policies 
  WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tenant_logos_read_public'
) THEN
  EXECUTE 'CREATE POLICY tenant_logos_read_public ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = ''tenant-logos'')';
END IF;

--    b) Escritura (insert/update/delete) para usuarios autenticados SOLO en este bucket
IF NOT EXISTS (
  SELECT 1 FROM pg_policies 
  WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tenant_logos_rw_authenticated'
) THEN
  EXECUTE 'CREATE POLICY tenant_logos_rw_authenticated ON storage.objects FOR ALL TO authenticated USING (bucket_id = ''tenant-logos'') WITH CHECK (bucket_id = ''tenant-logos'')';
END IF;

END $$;