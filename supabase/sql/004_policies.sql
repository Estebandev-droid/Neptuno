-- 004_policies.sql
  -- Funciones helpers + RLS para sistema educativo simplificado con roles de plataforma.

  begin;

  -- Limpieza idempotente de políticas para permitir re-ejecuciones del script
  DO $$
  DECLARE r record;
  BEGIN
    FOR r IN
      SELECT schemaname, tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN (
          'profiles','platform_admins','categories','courses','enrollments','resources','tasks','submissions','evaluations','grades','certificates','analytics_events','roles','user_roles',
          'campuses','areas','parent_student_relationships','observations','notifications','admission_documents','attendance','payments','forms','form_questions','question_options','form_responses','form_submissions',
          'certificate_templates','course_modules','lessons','lesson_progress','parent_teacher_messages','class_schedules','resource_library',
          'academic_years','terms','classrooms','sections','course_instructors','subjects','curriculum','announcements','events','notification_preferences',
          'question_bank','question_bank_options','rubrics','invoices','scholarships','student_scholarships','audit_log','library_loans','badges','user_badges','user_points'
        )
    LOOP
      EXECUTE format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
  END $$;

  -- Asegurar RLS activado
  alter table public.profiles enable row level security;
  alter table public.platform_admins enable row level security;
  alter table public.categories enable row level security;
  alter table public.courses enable row level security;
  alter table public.enrollments enable row level security;
  alter table public.resources enable row level security;
  alter table public.tasks enable row level security;
  alter table public.submissions enable row level security;
  alter table public.evaluations enable row level security;
  alter table public.grades enable row level security;
  alter table public.certificates enable row level security;
  alter table public.analytics_events enable row level security;
  -- storage.objects RLS se gestiona más abajo con comprobación de propietario
  -- Habilitar RLS en tablas de roles parametrizables
  alter table public.roles enable row level security;
  alter table public.user_roles enable row level security;

  -- Helper: obtener un rol (texto) del usuario (si tiene varios, devuelve el primero en orden alfabético)
  create or replace function public.get_role(p_user uuid default auth.uid())
  returns text
  language sql stable security definer set search_path = public as $$
    select coalesce(
      (
        select min(r.name)
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = p_user
      ),
      null
    )
  $$;

  -- Helper: ¿es admin de plataforma?
  create or replace function public.is_platform_admin(p_user uuid default auth.uid())
  returns boolean language sql stable security definer set search_path = public as $$
    select
      exists(select 1 from public.platform_admins pa where pa.user_id = p_user)
      or exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = p_user and r.name = 'platform_admin'
      );
  $$;

  -- Helper: ¿tiene rol específico?
  create or replace function public.has_role(p_role_name text, p_user uuid default auth.uid())
  returns boolean language sql stable security definer set search_path = public as $$
    select exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = p_user and r.name = p_role_name
    );
  $$;

  -- Profiles: cada quien su perfil; admins pueden ver todos
  create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id or is_platform_admin() or has_role('superadmin'));
  create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id or is_platform_admin() or has_role('superadmin'));
  create policy profiles_self_insert on public.profiles
  for insert with check (auth.uid() = id or is_platform_admin() or has_role('superadmin'));

  -- Platform admins: solo lectura para verificación
  create policy platform_admins_select on public.platform_admins
  for select using (is_platform_admin());

  -- Categorías: todos pueden ver, solo admins y teachers pueden modificar
  create policy categories_select on public.categories
  for select to authenticated using (true);
  create policy categories_write on public.categories
  for all using (is_platform_admin() or has_role('teacher'))
  with check (is_platform_admin() or has_role('teacher'));

  -- Cursos: todos pueden ver, solo admins y teachers pueden modificar
  create policy courses_select on public.courses
  for select to authenticated using (true);
  create policy courses_write on public.courses
  for all using (is_platform_admin() or has_role('teacher'))
  with check (is_platform_admin() or has_role('teacher'));

  -- Enrollments: estudiantes ven sus propias matrículas, admins y teachers ven todas
  create policy enrollments_select on public.enrollments
  for select using (auth.uid() = student_id or is_platform_admin() or has_role('teacher'));
  create policy enrollments_write on public.enrollments
  for all using (is_platform_admin() or has_role('teacher'))
  with check (is_platform_admin() or has_role('teacher'));

  -- Resources: todos los autenticados pueden ver, solo admins y teachers pueden modificar
  create policy resources_select on public.resources
  for select to authenticated using (true);
  create policy resources_write on public.resources
  for all using (is_platform_admin() or has_role('teacher'))
  with check (is_platform_admin() or has_role('teacher'));

  -- Tasks: todos los autenticados pueden ver, solo admins y teachers pueden modificar
  create policy tasks_select on public.tasks
  for select to authenticated using (true);
  create policy tasks_write on public.tasks
  for all using (is_platform_admin() or has_role('teacher'))
  with check (is_platform_admin() or has_role('teacher'));

  -- Submissions: estudiantes ven sus propias entregas, admins y teachers ven todas
  create policy submissions_select on public.submissions
  for select using (auth.uid() = student_id or is_platform_admin() or has_role('teacher'));
  create policy submissions_write on public.submissions
  for all using (auth.uid() = student_id or is_platform_admin() or has_role('teacher'))
  with check (auth.uid() = student_id or is_platform_admin() or has_role('teacher'));

  -- Evaluations: todos los autenticados pueden ver, solo admins y teachers pueden modificar
  create policy evaluations_select on public.evaluations
  for select to authenticated using (true);
  create policy evaluations_write on public.evaluations
  for all using (is_platform_admin() or has_role('teacher'))
  with check (is_platform_admin() or has_role('teacher'));

  -- Grades: estudiantes ven sus propias notas, admins y teachers ven todas
  create policy grades_select on public.grades
  for select using (auth.uid() = student_id or is_platform_admin() or has_role('teacher'));
  create policy grades_write on public.grades
  for all using (is_platform_admin() or has_role('teacher'))
  with check (is_platform_admin() or has_role('teacher'));

  -- Buckets (idempotentes)
  insert into storage.buckets (id, name, public)
  values ('media','media', true)
  on conflict (id) do nothing;
  insert into storage.buckets (id, name, public)
  values ('certificates','certificates', false)
  on conflict (id) do nothing;

  -- Asegurar RLS en storage.objects y políticas idempotentes (solo si el usuario actual es owner)
  DO $$
  DECLARE
    v_is_owner boolean;
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
      EXECUTE 'alter table storage.objects enable row level security';
      EXECUTE 'drop policy if exists "Public read media" on storage.objects';
      EXECUTE 'drop policy if exists "Authenticated write media" on storage.objects';
      EXECUTE 'drop policy if exists "Certificates read/write restricted" on storage.objects';
      -- nuevas: asegurar idempotencia de políticas adicionales para CRUD completo en media
      EXECUTE 'drop policy if exists "Admin update media" on storage.objects';
      EXECUTE 'drop policy if exists "Admin delete media" on storage.objects';
      EXECUTE 'create policy "Public read media" on storage.objects for select using (bucket_id = ''media'')';
      EXECUTE 'create policy "Authenticated write media" on storage.objects for insert to authenticated using (bucket_id = ''media'') with check (bucket_id = ''media'')';

      -- CRUD adicional en bucket media para platform_admin
      EXECUTE 'create policy "Admin update media" on storage.objects for update using (bucket_id = ''media'' and is_platform_admin()) with check (bucket_id = ''media'' and is_platform_admin())';
      EXECUTE 'create policy "Admin delete media" on storage.objects for delete using (bucket_id = ''media'' and is_platform_admin())';
      -- Bucket ''certificates'' solo admins y teachers
      EXECUTE 'create policy "Certificates read/write restricted" on storage.objects for all to authenticated using (bucket_id = ''certificates'' and (is_platform_admin() or has_role(''teacher''))) with check (bucket_id = ''certificates'' and (is_platform_admin() or has_role(''teacher'')))';
    ELSE
      RAISE NOTICE 'Omitiendo configuración de RLS en storage.objects porque el rol actual (%) no es el propietario', current_user;
    END IF;
  END $$;
  -- Políticas para certificados emitidos
  create policy certificates_select on public.certificates
  for select using (
    is_platform_admin() or has_role('teacher') or issued_to = auth.uid()
  );
  create policy certificates_write on public.certificates
  for all using (is_platform_admin() or has_role('teacher'))
  with check (is_platform_admin() or has_role('teacher'));

  -- Políticas para campuses
  create policy campuses_select on public.campuses
  for select to authenticated using (true);
  create policy campuses_write on public.campuses
  for all using (is_platform_admin())
  with check (is_platform_admin());

  -- Políticas para areas
  create policy areas_select on public.areas
  for select to authenticated using (true);
  create policy areas_write on public.areas
  for all using (is_platform_admin() or has_role('coordinator'))
  with check (is_platform_admin() or has_role('coordinator'));

  -- Políticas para parent_student_relationships
  create policy parent_student_relationships_select on public.parent_student_relationships
  for select using (
    parent_id = auth.uid() or student_id = auth.uid() or is_platform_admin()
  );
  create policy parent_student_relationships_write on public.parent_student_relationships
  for all using (is_platform_admin())
  with check (is_platform_admin());

  -- Políticas para observations
  create policy observations_select on public.observations
  for select using (
    student_id = auth.uid() or
    is_platform_admin() or
    has_role('teacher') or
    exists (
      select 1 from public.parent_student_relationships psr
      where psr.parent_id = auth.uid() and psr.student_id = observations.student_id
    )
  );
  create policy observations_write on public.observations
  for all using (is_platform_admin() or has_role('teacher'))
  with check (is_platform_admin() or has_role('teacher'));

  -- Políticas para notifications
  create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());
  create policy notifications_insert on public.notifications
  for insert with check (true);
  create policy notifications_update on public.notifications
  for update using (user_id = auth.uid());
  -- permitir borrado por dueño o admin
  create policy notifications_delete on public.notifications
  for delete using (user_id = auth.uid() or is_platform_admin());

  -- Políticas para admission_documents
  create policy admission_documents_select on public.admission_documents
  for select using (
    student_id = auth.uid() or
    is_platform_admin() or
    has_role('coordinator')
  );
  create policy admission_documents_write on public.admission_documents
  for all using (student_id = auth.uid() or is_platform_admin())
  with check (student_id = auth.uid() or is_platform_admin());

  -- Políticas para attendance
  create policy attendance_select on public.attendance
  for select using (
    student_id = auth.uid() or
    is_platform_admin() or
    has_role('teacher') or
    exists (
      select 1 from public.parent_student_relationships psr
      where psr.parent_id = auth.uid() and psr.student_id = attendance.student_id
    )
  );
  create policy attendance_write on public.attendance
  for all using (is_platform_admin() or has_role('teacher'))
  with check (is_platform_admin() or has_role('teacher'));

  -- Políticas para payments
  create policy payments_select on public.payments
  for select using (
    student_id = auth.uid() or
    is_platform_admin() or
    exists (
      select 1 from public.parent_student_relationships psr
      where psr.parent_id = auth.uid() and psr.student_id = payments.student_id
    )
  );
  create policy payments_write on public.payments
  for all using (is_platform_admin())
  with check (is_platform_admin());

  -- Políticas para forms
  create policy forms_select on public.forms
  for select using (auth.role() = 'authenticated');
  create policy forms_write on public.forms
  for all using (is_platform_admin() or has_role('teacher') or has_role('coordinator'))
  with check (is_platform_admin() or has_role('teacher') or has_role('coordinator'));

  -- Políticas para form_questions
  create policy form_questions_select on public.form_questions
  for select using (auth.role() = 'authenticated');
  create policy form_questions_write on public.form_questions
  for all using (is_platform_admin() or has_role('teacher') or has_role('coordinator'))
  with check (is_platform_admin() or has_role('teacher') or has_role('coordinator'));

  -- Políticas para question_options
  create policy question_options_select on public.question_options
  for select using (auth.role() = 'authenticated');
  create policy question_options_write on public.question_options
  for all using (is_platform_admin() or has_role('teacher') or has_role('coordinator'))
  with check (is_platform_admin() or has_role('teacher') or has_role('coordinator'));

  -- Políticas para form_responses
  create policy form_responses_select on public.form_responses
  for select using (
    user_id = auth.uid() or
    is_platform_admin() or
    has_role('teacher') or
    has_role('coordinator')
  );
  create policy form_responses_write on public.form_responses
  for all using (user_id = auth.uid() or is_platform_admin())
  with check (user_id = auth.uid() or is_platform_admin());

  -- Políticas para form_submissions
  create policy form_submissions_select on public.form_submissions
  for select using (
    user_id = auth.uid() or
    is_platform_admin() or
    has_role('teacher') or
    has_role('coordinator')
  );
  create policy form_submissions_write on public.form_submissions
  for all using (user_id = auth.uid() or is_platform_admin())
  with check (user_id = auth.uid() or is_platform_admin());

  -- Políticas para certificate_templates
  create policy certificate_templates_select on public.certificate_templates
  for select using (auth.role() = 'authenticated');
  create policy certificate_templates_write on public.certificate_templates
  for all using (is_platform_admin() or has_role('coordinator'))
  with check (is_platform_admin() or has_role('coordinator'));

  -- Políticas para course_modules
  create policy course_modules_select on public.course_modules
  for select using (auth.role() = 'authenticated');
  create policy course_modules_write on public.course_modules
  for all using (is_platform_admin() or has_role('teacher') or has_role('coordinator'))
  with check (is_platform_admin() or has_role('teacher') or has_role('coordinator'));

  -- Políticas para lessons
  create policy lessons_select on public.lessons
  for select using (auth.role() = 'authenticated');
  create policy lessons_write on public.lessons
  for all using (is_platform_admin() or has_role('teacher') or has_role('coordinator'))
  with check (is_platform_admin() or has_role('teacher') or has_role('coordinator'));

  -- Políticas para lesson_progress
  create policy lesson_progress_select on public.lesson_progress
  for select using (
    student_id = auth.uid() or
    is_platform_admin() or
    has_role('teacher') or
    has_role('coordinator')
  );
  create policy lesson_progress_write on public.lesson_progress
  for all using (student_id = auth.uid() or is_platform_admin() or has_role('teacher'))
  with check (student_id = auth.uid() or is_platform_admin() or has_role('teacher'));

  -- Políticas para parent_teacher_messages
  create policy parent_teacher_messages_select on public.parent_teacher_messages
  for select using (
    sender_id = auth.uid() or
    recipient_id = auth.uid() or
    is_platform_admin()
  );
  create policy parent_teacher_messages_write on public.parent_teacher_messages
  for all using (
    sender_id = auth.uid() or
    is_platform_admin()
  )
  with check (
    sender_id = auth.uid() or
    is_platform_admin()
  );

  -- Políticas para class_schedules
  create policy class_schedules_select on public.class_schedules
  for select using (auth.role() = 'authenticated');
  create policy class_schedules_write on public.class_schedules
  for all using (is_platform_admin() or has_role('coordinator'))
  with check (is_platform_admin() or has_role('coordinator'));

  -- Políticas para resource_library
  create policy resource_library_select on public.resource_library
  for select using (
    is_public = true or
    uploaded_by = auth.uid() or
    is_platform_admin() or
    has_role('teacher') or
    has_role('coordinator')
  );
  create policy resource_library_write on public.resource_library
  for all using (uploaded_by = auth.uid() or is_platform_admin())
  with check (uploaded_by = auth.uid() or is_platform_admin());

  -- Políticas para eventos de analítica
  create policy analytics_events_insert on public.analytics_events
    for insert with check (true);
  create policy analytics_events_select on public.analytics_events
    for select using (is_platform_admin());

  -- (duplicado RPC/roles eliminado)

  -- =============================================
  -- RLS POLICIES PARA NUEVAS TABLAS - ETAPAS 1-4
  -- =============================================

  -- Etapa 1: Gestión Académica Básica

  -- Academic Years
  alter table public.academic_years enable row level security;

  create policy "academic_years_select" on public.academic_years
    for select using (true);

  create policy "academic_years_insert" on public.academic_years
    for insert with check (is_platform_admin());

  create policy "academic_years_update" on public.academic_years
    for update using (is_platform_admin());

  create policy "academic_years_delete" on public.academic_years
    for delete using (is_platform_admin());

  -- Terms
  alter table public.terms enable row level security;

  create policy "terms_select" on public.terms
    for select using (true);

  create policy "terms_insert" on public.terms
    for insert with check (is_platform_admin());

  create policy "terms_update" on public.terms
    for update using (is_platform_admin());

  create policy "terms_delete" on public.terms
    for delete using (is_platform_admin());

  -- Classrooms
  alter table public.classrooms enable row level security;

  create policy "classrooms_select" on public.classrooms
    for select using (true);

  create policy "classrooms_insert" on public.classrooms
    for insert with check (is_platform_admin() or has_role('coordinator'));

  create policy "classrooms_update" on public.classrooms
    for update using (is_platform_admin() or has_role('coordinator'));

  create policy "classrooms_delete" on public.classrooms
    for delete using (is_platform_admin());

  -- Sections
  alter table public.sections enable row level security;

  create policy "sections_select" on public.sections
    for select using (
      is_platform_admin() or
      has_role('coordinator') or
      has_role('teacher') or
      exists (
        select 1 from public.enrollments e
        where e.course_id = course_id and e.student_id = auth.uid()
      )
    );

  create policy "sections_insert" on public.sections
    for insert with check (is_platform_admin() or has_role('coordinator'));

  create policy "sections_update" on public.sections
    for update using (is_platform_admin() or has_role('coordinator'));

  create policy "sections_delete" on public.sections
    for delete using (is_platform_admin());

  -- Course Instructors
  alter table public.course_instructors enable row level security;

  create policy "course_instructors_select" on public.course_instructors
    for select using (
      is_platform_admin() or
      has_role('coordinator') or
      instructor_id = auth.uid()
    );

  create policy "course_instructors_insert" on public.course_instructors
    for insert with check (is_platform_admin() or has_role('coordinator'));

  create policy "course_instructors_update" on public.course_instructors
    for update using (is_platform_admin() or has_role('coordinator'));

  create policy "course_instructors_delete" on public.course_instructors
    for delete using (is_platform_admin() or has_role('coordinator'));

  -- Etapa 2: Currículo y Comunicación

  -- Subjects
  alter table public.subjects enable row level security;

  create policy "subjects_select" on public.subjects
    for select using (true);

  create policy "subjects_insert" on public.subjects
    for insert with check (is_platform_admin() or has_role('coordinator'));

  create policy "subjects_update" on public.subjects
    for update using (is_platform_admin() or has_role('coordinator'));

  create policy "subjects_delete" on public.subjects
    for delete using (is_platform_admin());

  -- Curriculum
  alter table public.curriculum enable row level security;

  create policy "curriculum_select" on public.curriculum
    for select using (true);

  create policy "curriculum_insert" on public.curriculum
    for insert with check (is_platform_admin() or has_role('coordinator'));

  create policy "curriculum_update" on public.curriculum
    for update using (is_platform_admin() or has_role('coordinator'));

  create policy "curriculum_delete" on public.curriculum
    for delete using (is_platform_admin());

  -- Question Bank Options
  alter table public.question_bank_options enable row level security;

  create policy "question_bank_options_select" on public.question_bank_options
    for select using (
      exists (
        select 1 from public.question_bank qb
        where qb.id = question_id and (
          is_platform_admin() or
          has_role('coordinator') or
          has_role('teacher') or
          qb.created_by = auth.uid()
        )
      )
    );

  create policy "question_bank_options_insert" on public.question_bank_options
    for insert with check (
      exists (
        select 1 from public.question_bank qb
        where qb.id = question_id and (
          is_platform_admin() or
          has_role('coordinator') or
          has_role('teacher') or
          qb.created_by = auth.uid()
        )
      )
    );

  create policy "question_bank_options_update" on public.question_bank_options
    for update using (
      exists (
        select 1 from public.question_bank qb
        where qb.id = question_id and (
          is_platform_admin() or
          has_role('coordinator') or
          qb.created_by = auth.uid()
        )
      )
    );

  create policy "question_bank_options_delete" on public.question_bank_options
    for delete using (
      exists (
        select 1 from public.question_bank qb
        where qb.id = question_id and (
          is_platform_admin() or
          qb.created_by = auth.uid()
        )
      )
    );

  -- Rubrics
  alter table public.rubrics enable row level security;

  create policy "rubrics_select" on public.rubrics
    for select using (
      is_platform_admin() or
      has_role('coordinator') or
      has_role('teacher') or
      created_by = auth.uid()
    );

  create policy "rubrics_insert" on public.rubrics
    for insert with check (
      is_platform_admin() or
      has_role('coordinator') or
      has_role('teacher')
    );

  create policy "rubrics_update" on public.rubrics
    for update using (
      is_platform_admin() or
      has_role('coordinator') or
      created_by = auth.uid()
    );

  create policy "rubrics_delete" on public.rubrics
    for delete using (
      is_platform_admin() or
      created_by = auth.uid()
    );

  -- (línea eliminada por residuo de edición)

  -- User Badges
  alter table public.user_badges enable row level security;

  create policy "user_badges_select" on public.user_badges
    for select using (
      is_platform_admin() or
      has_role('coordinator') or
      has_role('teacher') or
      user_id = auth.uid() or
      exists (
        select 1 from public.parent_student_relationships psr
        where psr.parent_id = auth.uid() and psr.student_id = user_id
      )
    );

  create policy "user_badges_insert" on public.user_badges
    for insert with check (
      is_platform_admin() or
      has_role('coordinator') or
      has_role('teacher')
    );

  create policy "user_badges_update" on public.user_badges
    for update using (
      is_platform_admin() or
      has_role('coordinator') or
      awarded_by = auth.uid()
    );

  create policy "user_badges_delete" on public.user_badges
    for delete using (is_platform_admin());

  -- User Points
  alter table public.user_points enable row level security;

  create policy "user_points_select" on public.user_points
    for select using (
      is_platform_admin() or
      has_role('coordinator') or
      has_role('teacher') or
      user_id = auth.uid() or
      exists (
        select 1 from public.parent_student_relationships psr
        where psr.parent_id = auth.uid() and psr.student_id = user_id
      )
    );

  create policy "user_points_insert" on public.user_points
    for insert with check (
      is_platform_admin() or
      has_role('coordinator') or
      has_role('teacher')
    );

  create policy "user_points_update" on public.user_points
    for update using (
      is_platform_admin() or
      has_role('coordinator') or
      awarded_by = auth.uid()
    );

  create policy "user_points_delete" on public.user_points
    for delete using (is_platform_admin());

  commit;

  -- Habilitar RLS en tablas que tenían políticas pero no tenían `alter table ... enable row level security;` al inicio del script.
  alter table public.campuses enable row level security;
  alter table public.areas enable row level security;
  alter table public.parent_student_relationships enable row level security;
  alter table public.observations enable row level security;
  alter table public.notifications enable row level security;
  alter table public.admission_documents enable row level security;
  alter table public.attendance enable row level security;
  alter table public.payments enable row level security;
  alter table public.forms enable row level security;
  alter table public.form_questions enable row level security;
  alter table public.question_options enable row level security;
  alter table public.form_responses enable row level security;
  alter table public.form_submissions enable row level security;
  alter table public.certificate_templates enable row level security;
  alter table public.course_modules enable row level security;
  alter table public.lessons enable row level security;
  alter table public.lesson_progress enable row level security;
  alter table public.parent_teacher_messages enable row level security;
  alter table public.class_schedules enable row level security;
  alter table public.resource_library enable row level security;
  alter table public.user_roles enable row level security;

  -- Habilitar RLS en tablas adicionales con policies definidas más abajo
  alter table public.campuses enable row level security;
  alter table public.areas enable row level security;
  alter table public.parent_student_relationships enable row level security;
  alter table public.observations enable row level security;
  alter table public.notifications enable row level security;
  alter table public.admission_documents enable row level security;
  alter table public.attendance enable row level security;
  alter table public.payments enable row level security;
  alter table public.forms enable row level security;
  alter table public.form_questions enable row level security;
  alter table public.question_options enable row level security;
  alter table public.form_responses enable row level security;
  alter table public.form_submissions enable row level security;
  alter table public.certificate_templates enable row level security;
  alter table public.course_modules enable row level security;
  alter table public.lessons enable row level security;
  alter table public.lesson_progress enable row level security;
  alter table public.parent_teacher_messages enable row level security;
  alter table public.class_schedules enable row level security;
  alter table public.resource_library enable row level security;
  alter table public.user_roles enable row level security;

  -- Helper: obtener un rol (texto) del usuario (si tiene varios, devuelve el primero en orden alfabético)
  create or replace function public.get_role(p_user uuid default auth.uid())
  returns text
  language sql stable security definer set search_path = public as $$
    select coalesce(
      (
        select min(r.name)
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = p_user
      ),
      null
    )
  $$;

  -- Helper: ¿es admin de plataforma?
  create or replace function public.is_platform_admin(p_user uuid default auth.uid())
  returns boolean language sql stable security definer set search_path = public as $$
    select
      exists(select 1 from public.platform_admins pa where pa.user_id = p_user)
      or exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = p_user and r.name = 'platform_admin'
      );
  $$;

  -- Helper: ¿tiene rol específico?
  create or replace function public.has_role(p_role_name text, p_user uuid default auth.uid())
  returns boolean language sql stable security definer set search_path = public as $$
    select exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = p_user and r.name = p_role_name
    );
  $$;

  -- (bloque duplicado eliminado)

  commit;-- RPC para asignar rol a usuario (simplificado)
  create or replace function public.assign_user_role(p_user uuid, p_role_name text)
  returns void language plpgsql security definer set search_path = public as $$
  declare v_role_id uuid; begin
    select id into v_role_id from public.roles where name = p_role_name limit 1;
    if v_role_id is null then
      raise exception 'Rol % no existe', p_role_name;
    end if;
    insert into public.user_roles(user_id, role_id)
    values (p_user, v_role_id)
    on conflict (user_id, role_id) do nothing;
  end; $$;

  -- Políticas para roles (solo platform_admin y superadmin)
  create policy roles_select on public.roles
  for select using (is_platform_admin() or has_role('superadmin'));
  create policy roles_write on public.roles
  for all using (is_platform_admin() or has_role('superadmin')) with check (is_platform_admin() or has_role('superadmin'));

  -- Políticas para user_roles
  create policy user_roles_select on public.user_roles
  for select using (is_platform_admin() or has_role('superadmin') or auth.uid() = user_id);
  create policy user_roles_write on public.user_roles
  for all to authenticated using (is_platform_admin() or has_role('superadmin'));

  commit;

  -- (bloque duplicado de etapas 1-4 eliminado)