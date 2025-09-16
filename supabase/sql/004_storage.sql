-- =============================================
-- CONFIGURACIÓN DE STORAGE BUCKETS
-- =============================================

-- Bucket para imágenes de portada de cursos
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'course-covers') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'course-covers',
      'course-covers',
      true,
      5242880, -- 5MB
      array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    );
  end if;
end $$;

-- Políticas RLS para course-covers bucket
create policy "Lectura pública de portadas de cursos"
  on storage.objects for select
  using (bucket_id = 'course-covers');

create policy "Usuarios autenticados pueden subir portadas"
  on storage.objects for insert
  with check (
    bucket_id = 'course-covers' and
    auth.role() = 'authenticated'
  );

create policy "Usuarios pueden actualizar sus propias portadas"
  on storage.objects for update
  using (
    bucket_id = 'course-covers' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuarios pueden eliminar sus propias portadas"
  on storage.objects for delete
  using (
    bucket_id = 'course-covers' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================
-- BUCKET PARA ARCHIVOS DE RECURSOS
-- =============================================

-- Bucket para archivos de recursos de cursos
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'resource-files') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'resource-files',
      'resource-files',
      false, -- Privado por defecto
      52428800, -- 50MB
      array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav'
      ]
    );
  end if;
end $$;

-- Políticas RLS para resource-files bucket
create policy "Usuarios autenticados pueden ver recursos"
  on storage.objects for select
  using (
    bucket_id = 'resource-files' and
    auth.role() = 'authenticated'
  );

create policy "Usuarios autenticados pueden subir recursos"
  on storage.objects for insert
  with check (
    bucket_id = 'resource-files' and
    auth.role() = 'authenticated'
  );

create policy "Usuarios pueden actualizar sus propios recursos"
  on storage.objects for update
  using (
    bucket_id = 'resource-files' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuarios pueden eliminar sus propios recursos"
  on storage.objects for delete
  using (
    bucket_id = 'resource-files' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================
-- BUCKET PARA LOGOS DE TENANTS
-- =============================================

-- Bucket para logos de tenants/organizaciones
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'tenant-logos') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'tenant-logos',
      'tenant-logos',
      true, -- Público para mostrar logos
      2097152, -- 2MB
      array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    );
  end if;
end $$;

-- Políticas RLS para tenant-logos bucket
create policy "Lectura pública de logos de tenants"
  on storage.objects for select
  using (bucket_id = 'tenant-logos');

create policy "Usuarios autenticados pueden subir logos"
  on storage.objects for insert
  with check (
    bucket_id = 'tenant-logos' and
    auth.role() = 'authenticated'
  );

create policy "Usuarios pueden actualizar logos de su tenant"
  on storage.objects for update
  using (
    bucket_id = 'tenant-logos' and
    auth.role() = 'authenticated'
  );

create policy "Usuarios pueden eliminar logos de su tenant"
  on storage.objects for delete
  using (
    bucket_id = 'tenant-logos' and
    auth.role() = 'authenticated'
  );

commit;