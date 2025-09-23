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

-- =============================================
-- BUCKET PARA AVATARES DE USUARIOS
-- =============================================

-- Bucket para avatares de usuarios
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'user-avatars') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'user-avatars',
      'user-avatars',
      true, -- Público para mostrar avatares
      3145728, -- 3MB
      array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    );
  end if;
end $$;

-- Políticas RLS para user-avatars bucket
create policy "Lectura pública de avatares de usuarios"
  on storage.objects for select
  using (bucket_id = 'user-avatars');

create policy "Usuarios pueden subir su propio avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'user-avatars' and
    auth.role() = 'authenticated' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuarios pueden actualizar su propio avatar"
  on storage.objects for update
  using (
    bucket_id = 'user-avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuarios pueden eliminar su propio avatar"
  on storage.objects for delete
  using (
    bucket_id = 'user-avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================
-- BUCKET PARA FIRMAS DIGITALES
-- =============================================

-- Bucket para firmas digitales de usuarios
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'user-signatures') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'user-signatures',
      'user-signatures',
      false, -- Privado por seguridad
      1048576, -- 1MB
      array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    );
  end if;
end $$;

-- Políticas RLS para user-signatures bucket
create policy "Usuarios pueden ver su propia firma"
  on storage.objects for select
  using (
    bucket_id = 'user-signatures' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuarios pueden subir su propia firma"
  on storage.objects for insert
  with check (
    bucket_id = 'user-signatures' and
    auth.role() = 'authenticated' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuarios pueden actualizar su propia firma"
  on storage.objects for update
  using (
    bucket_id = 'user-signatures' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuarios pueden eliminar su propia firma"
  on storage.objects for delete
  using (
    bucket_id = 'user-signatures' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política adicional para que profesores/admins puedan ver firmas para certificados
create policy "Profesores y admins pueden ver firmas para certificados"
  on storage.objects for select
  using (
    bucket_id = 'user-signatures' and
    (
      public.is_platform_admin() or
      public.has_role('teacher') or
      public.has_role('tenant_admin')
    )
  );

-- =============================================
-- BUCKETS AVANZADOS PARA FUNCIONALIDADES EXTENDIDAS
-- =============================================

-- Bucket para grabaciones de clases en vivo
-- Legacy bucket 'live-recordings' removed (unified into 'media')

-- Bucket para recursos de clases en vivo
-- Legacy bucket 'live-resources' removed (unified into 'resource-files')

-- Bucket para avatares HD
-- Legacy bucket 'avatars-hd' removed (use 'user-avatars')

-- Bucket para entregas de tareas multimedia
-- Legacy bucket 'task-submissions' removed (unified into 'resource-files')

-- Bucket para certificados personalizados
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'certificates-custom') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'certificates-custom',
      'certificates-custom',
      false, -- Privado por defecto
      52428800, -- 50MB
      array[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/svg+xml'
      ]
    );
  end if;
end $$;

-- Bucket para contenido de gamificación
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'gamification') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'gamification',
      'gamification',
      true, -- Público para mostrar badges, etc.
      5242880, -- 5MB
      array[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/svg+xml',
        'image/gif'
      ]
    );
  end if;
end $$;

-- Bucket para exportaciones y backups
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'exports') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'exports',
      'exports',
      false, -- Privado por defecto
      1073741824, -- 1GB
      array[
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/json',
        'application/zip'
      ]
    );
  end if;
end $$;

-- =============================================
-- POLÍTICAS AVANZADAS PARA GRABACIONES DE CLASES
-- =============================================

-- Política para subir grabaciones (instructores)
create policy "Instructors can upload live class recordings"
  on storage.objects for insert
  with check (
    bucket_id = 'media'
    and
    (
      exists (
        select 1 from public.live_classes lc
        join public.courses c on c.id = lc.course_id
        where c.instructor_id = auth.uid()
          and position(lc.id::text in name) > 0
      )
      or
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('tenant_admin', 'super_admin')
      )
      or
      exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid()
          and m.role in ('admin', 'owner')
          and m.is_active = true
      )
    )
  );

-- Política para ver grabaciones (estudiantes inscritos, instructores, padres)
create policy "Users can view relevant live class recordings"
  on storage.objects for select
  using (
    bucket_id = 'media'
    and
    (
      exists (
        select 1 from public.live_classes lc
        join public.courses c on c.id = lc.course_id
        where c.instructor_id = auth.uid()
          and position(lc.id::text in name) > 0
      )
      or
      exists (
        select 1 from public.live_classes lc
        join public.courses c on c.id = lc.course_id
        join public.enrollments e on e.course_id = c.id
        where e.student_id = auth.uid()
          and e.status = 'active'
          and position(lc.id::text in name) > 0
      )
      or
      exists (
        select 1 from public.relationships r
        join public.enrollments e on e.student_id = r.student_id
        join public.courses c on c.id = e.course_id
        join public.live_classes lc on lc.course_id = c.id
        where r.parent_id = auth.uid()
          and e.status = 'active'
          and position(lc.id::text in name) > 0
      )
    )
  );

-- Política para actualizar grabaciones (instructores)
create policy "Instructors can update their live class recordings"
  on storage.objects for update
  using (
    bucket_id = 'media'
    and
    exists (
      select 1 from public.live_classes lc
      join public.courses c on c.id = lc.course_id
      where c.instructor_id = auth.uid()
        and position(lc.id::text in name) > 0
    )
  )
  with check (
    bucket_id = 'media'
    and
    exists (
      select 1 from public.live_classes lc
      join public.courses c on c.id = lc.course_id
      where c.instructor_id = auth.uid()
        and position(lc.id::text in name) > 0
    )
  );

-- Política para eliminar grabaciones (instructores y admins)
create policy "Instructors and admins can delete live class recordings"
  on storage.objects for delete
  using (
    bucket_id = 'media'
    and
    (
      exists (
        select 1 from public.live_classes lc
        join public.courses c on c.id = lc.course_id
        where c.instructor_id = auth.uid()
          and position(lc.id::text in name) > 0
      )
      or
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('tenant_admin', 'super_admin')
      )
      or
      exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid()
          and m.role in ('admin', 'owner')
          and m.is_active = true
      )
    )
  );

-- =============================================
-- POLÍTICAS PARA RECURSOS DE CLASES EN VIVO
-- =============================================

-- Política para subir recursos (instructores)
create policy "Instructors can upload live class resources"
  on storage.objects for insert
  with check (
    bucket_id = 'resource-files'
    and
    (
      exists (
        select 1 from public.courses c
        where c.instructor_id = auth.uid()
          and position(c.id::text in name) > 0
      )
      or
      exists (
        select 1 from public.enrollments e
        join public.courses c on c.id = e.course_id
        where e.student_id = auth.uid()
          and e.status = 'active'
          and position(c.id::text in name) > 0
      )
    )
  );

-- Política para ver recursos (estudiantes inscritos, instructores)
create policy "Users can view relevant live class resources"
  on storage.objects for select
  using (
    bucket_id = 'resource-files'
    and
    (
      exists (
        select 1 from public.courses c
        where c.instructor_id = auth.uid()
          and position(c.id::text in name) > 0
      )
      or
      exists (
        select 1 from public.enrollments e
        join public.courses c on c.id = e.course_id
        where e.student_id = auth.uid()
          and e.status = 'active'
          and position(c.id::text in name) > 0
      )
    )
  );

-- =============================================
-- POLÍTICAS PARA ENTREGAS DE TAREAS
-- =============================================

-- Política para subir entregas (estudiantes)
create policy "Students can upload task submissions"
  on storage.objects for insert
  with check (
    bucket_id = 'resource-files'
    and
    (
      exists (
        select 1 from public.tasks t
        join public.enrollments e on e.course_id = t.course_id
        where e.student_id = auth.uid()
          and e.status = 'active'
          and position(t.id::text in name) > 0
      )
      or
      position(auth.uid()::text in name) > 0
    )
  );

-- Política para ver entregas (estudiantes propias, instructores, padres)
create policy "Users can view relevant task submissions"
  on storage.objects for select
  using (
    bucket_id = 'resource-files'
    and
    (
      position(auth.uid()::text in name) > 0
      or
      exists (
        select 1 from public.tasks t
        join public.courses c on c.id = t.course_id
        where c.instructor_id = auth.uid()
          and position(t.id::text in name) > 0
      )
      or
      exists (
        select 1 from public.relationships r
        where r.parent_id = auth.uid()
          and position(r.student_id::text in name) > 0
      )
    )
  );

-- =============================================
-- POLÍTICAS PARA AVATARES HD
-- =============================================

-- Política para subir avatares (usuarios propios)
create policy "Users can upload their own HD avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'user-avatars'
    and
    position(auth.uid()::text in name) > 0
  );

-- Política para ver avatares (público)
create policy "HD avatars are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'user-avatars');

-- Política para actualizar avatares (usuarios propios)
create policy "Users can update their own HD avatars"
  on storage.objects for update
  using (
    bucket_id = 'user-avatars'
    and
    position(auth.uid()::text in name) > 0
  )
  with check (
    bucket_id = 'user-avatars'
    and
    position(auth.uid()::text in name) > 0
  );

-- Política para eliminar avatares (usuarios propios)
create policy "Users can delete their own HD avatars"
  on storage.objects for delete
  using (
    bucket_id = 'user-avatars'
    and
    position(auth.uid()::text in name) > 0
  );

-- =============================================
-- POLÍTICAS PARA CERTIFICADOS PERSONALIZADOS
-- =============================================

-- Política para subir plantillas de certificados (admins)
create policy "Admins can upload certificate templates"
  on storage.objects for insert
  with check (
    bucket_id = 'certificates-custom'
    and
    exists (
      select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('tenant_admin', 'super_admin')
      )
      or
      exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid()
          and m.role in ('admin', 'owner')
          and m.is_active = true
    )
  );

-- Política para ver certificados (usuarios del tenant)
create policy "Tenant users can view certificates"
  on storage.objects for select
  using (
    bucket_id = 'certificates-custom'
    and
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.is_active = true
    )
  );

-- =============================================
-- POLÍTICAS PARA GAMIFICACIÓN
-- =============================================

-- Política para subir contenido de gamificación (admins)
create policy "Admins can upload gamification content"
  on storage.objects for insert
  with check (
    bucket_id = 'gamification'
    and
    (
      public.is_platform_admin() OR 
      public.has_role('super_admin') OR
      public.has_role('tenant_admin')
    )
  );

-- Política para ver contenido de gamificación (público)
create policy "Gamification content is publicly viewable"
  on storage.objects for select
  using (bucket_id = 'gamification');

-- =============================================
-- POLÍTICAS PARA EXPORTACIONES
-- =============================================

-- Política para crear exportaciones (admins e instructores)
create policy "Admins and instructors can create exports"
  on storage.objects for insert
  with check (
    bucket_id = 'exports'
    and
    (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('tenant_admin', 'super_admin')
      )
      or
      exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid()
          and m.role in ('admin', 'owner')
          and m.is_active = true
      )
      or
      exists (
        select 1 from public.courses c
        where c.instructor_id = auth.uid()
      )
    )
  );

-- Política para ver exportaciones (creador y admins)
create policy "Users can view their own exports"
  on storage.objects for select
  using (
    bucket_id = 'exports'
    and
    (
      position(auth.uid()::text in name) > 0
      or
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('tenant_admin', 'super_admin')
      )
      or
      exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid()
          and m.role in ('admin', 'owner')
          and m.is_active = true
      )
    )
  );

-- Política para eliminar exportaciones (creador y admins)
create policy "Users can delete their own exports"
  on storage.objects for delete
  using (
    bucket_id = 'exports'
    and
    (
      position(auth.uid()::text in name) > 0
      or
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('tenant_admin', 'super_admin')
      )
      or
      exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid()
          and m.role in ('admin', 'owner')
          and m.is_active = true
      )
    )
  );

-- =============================================
-- FUNCIONES AUXILIARES PARA STORAGE
-- =============================================

-- Función para limpiar archivos huérfanos
create or replace function cleanup_orphaned_files()
returns void
language plpgsql
security definer
as $$
begin
  -- Limpiar grabaciones de clases eliminadas
  delete from storage.objects
  where bucket_id = 'media'
    and not exists (
      select 1 from public.live_classes lc
      where position(lc.id::text in name) > 0
    )
    and created_at < now() - interval '7 days';

  -- Limpiar recursos de clases eliminadas
  delete from storage.objects
  where bucket_id = 'resource-files'
    and not exists (
      select 1 from public.live_classes lc
      where position(lc.id::text in name) > 0
    )
    and created_at < now() - interval '7 days';

  -- Limpiar entregas de tareas eliminadas
  delete from storage.objects
  where bucket_id = 'resource-files'
    and not exists (
      select 1 from public.tasks t
      where position(t.id::text in name) > 0
    )
    and created_at < now() - interval '30 days';

  -- Limpiar avatares de usuarios eliminados
  delete from storage.objects
  where bucket_id in ('user-avatars')
    and not exists (
      select 1 from public.profiles p
      where position(p.id::text in name) > 0
    )
    and created_at < now() - interval '7 days';
end;
$$;

-- Función para obtener estadísticas de storage
create or replace function get_storage_stats(
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
  v_total_size bigint;
  v_file_count integer;
begin
  -- Calcular estadísticas generales
  select 
    coalesce(sum(metadata->>'size')::bigint, 0),
    count(*)
  into v_total_size, v_file_count
  from storage.objects
  where case 
    when p_tenant_id is not null then
      exists (
        select 1 from public.profiles p
        where p.tenant_id = p_tenant_id
          and position(p.id::text in name) > 0
      )
    else true
  end;

  v_result := jsonb_build_object(
    'total_size_bytes', v_total_size,
    'total_files', v_file_count,
    'total_size_mb', round(v_total_size / 1048576.0, 2),
    'generated_at', now()
  );

  -- Agregar estadísticas por bucket
  select jsonb_object_agg(
    bucket_id,
    jsonb_build_object(
      'file_count', file_count,
      'total_size_bytes', total_size,
      'total_size_mb', round(total_size / 1048576.0, 2)
    )
  ) into v_result
  from (
    select 
      bucket_id,
      count(*) as file_count,
      coalesce(sum(metadata->>'size')::bigint, 0) as total_size
    from storage.objects
    where case 
      when p_tenant_id is not null then
        exists (
          select 1 from public.profiles p
          where p.tenant_id = p_tenant_id
            and position(p.id::text in name) > 0
        )
      else true
    end
    group by bucket_id
  ) bucket_stats;

  return v_result;
end;
$$;

commit;