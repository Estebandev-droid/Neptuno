-- =============================================
-- 006_storage.sql
-- Crea bucket de Storage `course-covers` y políticas necesarias (idempotente)
-- =============================================

begin;

-- 1) Crear bucket si no existe (público para lectura)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'course-covers') THEN
    BEGIN
      PERFORM storage.create_bucket('course-covers');
    EXCEPTION
      WHEN undefined_function THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('course-covers','course-covers', true)
        ON CONFLICT (id) DO NOTHING;
    END;
  END IF;
END $$;

-- 2) Restringir tipos MIME y tamaño máx. (opcional)
UPDATE storage.buckets
SET public = true,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'],
    file_size_limit = 5 * 1024 * 1024 -- 5MB
WHERE id = 'course-covers';

-- 3) Políticas RLS sobre storage.objects
--    a) Lectura pública (anon y authenticated) SOLO para este bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'course_covers_read_public'
  ) THEN
    EXECUTE 'CREATE POLICY course_covers_read_public ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = ''course-covers'')';
  END IF;
END $$;

--    b) Escritura (insert/update/delete) para usuarios autenticados SOLO en este bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'course_covers_rw_authenticated'
  ) THEN
    EXECUTE 'CREATE POLICY course_covers_rw_authenticated ON storage.objects FOR ALL TO authenticated USING (bucket_id = ''course-covers'') WITH CHECK (bucket_id = ''course-covers'')';
  END IF;
END $$;

commit;