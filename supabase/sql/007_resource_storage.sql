-- =============================================
-- 007_resource_storage.sql
-- Crea bucket de Storage `resource-files` y políticas necesarias (idempotente)
-- =============================================

begin;

-- 1) Crear bucket si no existe (público para lectura)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'resource-files') THEN
    BEGIN
      PERFORM storage.create_bucket('resource-files');
    EXCEPTION
      WHEN undefined_function THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('resource-files','resource-files', true)
        ON CONFLICT (id) DO NOTHING;
    END;
  END IF;
END $$;

-- 2) Configurar tipos MIME permitidos y tamaño máximo
UPDATE storage.buckets
SET public = true,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/webp','image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'video/mp4','video/webm','video/ogg',
      'audio/mpeg','audio/wav','audio/ogg'
    ],
    file_size_limit = 50 * 1024 * 1024 -- 50MB
WHERE id = 'resource-files';

-- 3) Políticas RLS sobre storage.objects
--    a) Lectura pública (anon y authenticated) SOLO para este bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'resource_files_read_public'
  ) THEN
    EXECUTE 'CREATE POLICY resource_files_read_public ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = ''resource-files'')';
  END IF;
END $$;

--    b) Escritura (insert/update/delete) para usuarios autenticados SOLO en este bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'resource_files_rw_authenticated'
  ) THEN
    EXECUTE 'CREATE POLICY resource_files_rw_authenticated ON storage.objects FOR ALL TO authenticated USING (bucket_id = ''resource-files'') WITH CHECK (bucket_id = ''resource-files'')';
  END IF;
END $$;

commit;