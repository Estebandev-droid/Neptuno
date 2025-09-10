-- 003_seed.sql
-- Seed inicial para sistema educativo simplificado: crea roles base y utilidades para asignar admin.

begin;

-- Roles base (solo plataforma)
insert into public.roles (name, description, is_system)
values
  ('platform_admin','Administrador global', true),
  ('teacher','Docente', true),
  ('student','Estudiante', true)
on conflict (name) do nothing;

-- Insertar áreas académicas base
insert into public.areas (code, name, description) values
  ('MAT', 'Matemáticas', 'Área de matemáticas y ciencias exactas'),
  ('CIE', 'Ciencias Naturales', 'Física, química, biología y ciencias experimentales'),
  ('HUM', 'Humanidades', 'Literatura, historia, filosofía y ciencias sociales'),
  ('TEC', 'Tecnología e Informática', 'Programación, sistemas y tecnología digital'),
  ('ART', 'Artes', 'Música, pintura, teatro y expresión artística'),
  ('EDU', 'Educación Física', 'Deportes, recreación y actividad física'),
  ('IDI', 'Idiomas', 'Inglés, francés y otros idiomas extranjeros');

-- Insertar campuses demo
insert into public.campuses (name, address) values
  ('Campus Principal', 'Av. Principal 123, Ciudad'),
  ('Campus Norte', 'Calle Norte 456, Zona Norte'),
  ('Campus Virtual', 'Plataforma en línea');

-- Insertar plantillas de certificados
insert into public.certificate_templates (name, description, template_type, design_config) values
  ('Certificado de Finalización', 'Plantilla estándar para cursos completados', 'completion', 
   '{"background_color": "#ffffff", "border_color": "#0066cc", "font_family": "Arial", "logo_position": "top-center"}'),
  ('Certificado de Excelencia', 'Para estudiantes destacados', 'excellence',
   '{"background_color": "#f8f9fa", "border_color": "#28a745", "font_family": "Times New Roman", "accent_color": "#ffd700"}'),
  ('Certificado de Participación', 'Para eventos y talleres', 'participation',
   '{"background_color": "#ffffff", "border_color": "#6c757d", "font_family": "Arial", "simple_design": true}');

-- Categorías base (compatibilidad según esquema)
DO $$
DECLARE
  v_has_description boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'categories'
      AND column_name = 'description'
  ) INTO v_has_description;

  IF v_has_description THEN
    INSERT INTO public.categories (id, name, description)
    VALUES 
      (gen_random_uuid(), 'General', 'Categoría general para contenido diverso'),
      (gen_random_uuid(), 'Matemáticas', 'Cursos relacionados con matemáticas y ciencias exactas'),
      (gen_random_uuid(), 'Ciencias', 'Cursos de ciencias naturales y experimentales'),
      (gen_random_uuid(), 'Humanidades', 'Cursos de literatura, historia y ciencias sociales'),
      (gen_random_uuid(), 'Tecnología', 'Cursos de informática y tecnología'),
      (gen_random_uuid(), 'Artes', 'Cursos creativos y artísticos')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.categories (id, name)
    VALUES 
      (gen_random_uuid(), 'General'),
      (gen_random_uuid(), 'Matemáticas'),
      (gen_random_uuid(), 'Ciencias'),
      (gen_random_uuid(), 'Humanidades'),
      (gen_random_uuid(), 'Tecnología'),
      (gen_random_uuid(), 'Artes')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Evento de analítica de ejemplo
insert into public.analytics_events (user_id, event, properties)
values (null, 'system_initialized', '{"source":"seed"}'::jsonb)
on conflict do nothing;

-- Insertar formularios de ejemplo
insert into public.forms (title, description, form_type, is_active) values
  ('Evaluación de Matemáticas Básicas', 'Examen diagnóstico de conocimientos matemáticos', 'evaluation', true),
  ('Encuesta de Satisfacción del Curso', 'Evaluación de la calidad del curso por parte de los estudiantes', 'survey', true),
  ('Formulario de Admisión', 'Datos requeridos para el proceso de inscripción', 'admission', true);

-- Insertar preguntas de ejemplo para el formulario de matemáticas
do $$
declare
  v_form_id uuid;
  v_question_id uuid;
begin
  -- Obtener el ID del formulario de matemáticas
  select id into v_form_id from public.forms where title = 'Evaluación de Matemáticas Básicas' limit 1;
  
  if v_form_id is not null then
    -- Pregunta de opción múltiple
    insert into public.form_questions (form_id, question_text, question_type, is_required, order_index, points)
    values (v_form_id, '¿Cuál es el resultado de 2 + 2?', 'multiple_choice', true, 1, 10)
    returning id into v_question_id;
    
    -- Opciones para la pregunta
    insert into public.question_options (question_id, option_text, is_correct, order_index) values
      (v_question_id, '3', false, 1),
      (v_question_id, '4', true, 2),
      (v_question_id, '5', false, 3),
      (v_question_id, '6', false, 4);
    
    -- Pregunta abierta
    insert into public.form_questions (form_id, question_text, question_type, is_required, order_index, points)
    values (v_form_id, 'Explica el proceso para resolver una ecuación de primer grado', 'text', true, 2, 15);
  end if;
end;
$$;

-- Insertar recursos de biblioteca de ejemplo
insert into public.resource_library (title, description, resource_type, subject_area, grade_level, tags, is_public) values
  ('Guía de Álgebra Básica', 'Manual completo de álgebra para principiantes', 'document', 'Matemáticas', 'Secundaria', '{"álgebra", "matemáticas", "ecuaciones"}', true),
  ('Video: Introducción a la Física', 'Conceptos fundamentales de física explicados de forma sencilla', 'video', 'Ciencias', 'Secundaria', '{"física", "ciencias", "conceptos básicos"}', true),
  ('Calculadora Científica Online', 'Herramienta web para cálculos matemáticos avanzados', 'tool', 'Matemáticas', 'Todos', '{"calculadora", "herramienta", "matemáticas"}', true);

-- Función utilitaria para asignar admin a un usuario dado
create or replace function public.seed_admin(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role_platform uuid;
  v_role_teacher uuid;
begin
  select id into v_role_platform from public.roles where name = 'platform_admin';
  select id into v_role_teacher from public.roles where name = 'teacher';

  -- asignar rol de platform_admin
  insert into public.user_roles (user_id, role_id)
  values (p_user, v_role_platform)
  on conflict (user_id, role_id) do nothing;

  -- asignar también rol de teacher para funcionalidad completa
  insert into public.user_roles (user_id, role_id)
  values (p_user, v_role_teacher)
  on conflict (user_id, role_id) do nothing;

  -- conveniencia: agregar a platform_admins
  insert into public.platform_admins (user_id)
  values (p_user)
  on conflict (user_id) do nothing;
end;
$$;

commit;

-- Seeds para Etapa 1
do $$
declare
  v_academic_year_id uuid;
  v_term_id uuid;
  v_campus_id uuid;
  v_classroom_id uuid;
  v_area_id uuid;
begin
  -- Año académico demo
  insert into public.academic_years (name, start_date, end_date, is_active)
  values ('2024', '2024-01-15', '2024-12-15', true)
  on conflict (name) do nothing
  returning id into v_academic_year_id;
  
  if v_academic_year_id is null then
    select id into v_academic_year_id from public.academic_years where name = '2024';
  end if;
  
  -- Períodos académicos
  insert into public.terms (academic_year_id, name, start_date, end_date, order_index)
  values 
    (v_academic_year_id, 'Primer Semestre', '2024-01-15', '2024-06-15', 1),
    (v_academic_year_id, 'Segundo Semestre', '2024-07-15', '2024-12-15', 2)
  on conflict (academic_year_id, name) do nothing;
  
  select id into v_term_id from public.terms where academic_year_id = v_academic_year_id and name = 'Primer Semestre';
  
  -- Campus demo
  select id into v_campus_id from public.campuses limit 1;
  
  -- Aula demo
  if v_campus_id is not null then
    insert into public.classrooms (campus_id, code, name, capacity, location)
    values (v_campus_id, 'A101', 'Aula 101 - Bloque A', 30, 'Primer piso, Bloque A')
    on conflict (campus_id, code) do nothing;
  end if;
end $$;

-- Seeds para Etapa 2
do $$
declare
  v_area_id uuid;
  v_subject_id uuid;
  v_admin_id uuid;
begin
  -- Obtener área académica
  select id into v_area_id from public.areas limit 1;
  select user_id into v_admin_id from public.platform_admins limit 1;
  
  -- Materias demo
  if v_area_id is not null then
    insert into public.subjects (area_id, code, name, description, credits)
    values 
      (v_area_id, 'MAT101', 'Matemáticas Básicas', 'Fundamentos de matemáticas', 3),
      (v_area_id, 'ESP101', 'Español y Literatura', 'Comunicación y literatura', 3),
      (v_area_id, 'CIE101', 'Ciencias Naturales', 'Introducción a las ciencias', 4)
    on conflict (code) do nothing;
  end if;
  
  -- Currículum demo
  select id into v_subject_id from public.subjects where code = 'MAT101';
  if v_subject_id is not null then
    insert into public.curriculum (program_name, subject_id, semester, is_mandatory)
    values ('Bachillerato General', v_subject_id, 1, true)
    on conflict (program_name, subject_id) do nothing;
  end if;
  
  -- Anuncio demo
  if v_admin_id is not null then
    insert into public.announcements (title, content, announcement_type, target_audience, is_published, created_by)
    values (
      'Bienvenidos al nuevo año académico',
      'Les damos la bienvenida a todos los estudiantes y familias al año académico 2024.',
      'general',
      '{"student","parent","teacher"}',
      true,
      v_admin_id
    );
  end if;
end $$;

-- Seeds para Etapa 3
do $$
declare
  v_subject_id uuid;
  v_question_id uuid;
  v_admin_id uuid;
  v_student_id uuid;
begin
  select id into v_subject_id from public.subjects where code = 'MAT101';
  select user_id into v_admin_id from public.platform_admins limit 1;
  
  -- Pregunta demo en banco de preguntas
  if v_subject_id is not null and v_admin_id is not null then
    insert into public.question_bank (subject_id, question_text, question_type, difficulty_level, points, created_by)
    values (
      v_subject_id,
      '¿Cuál es el resultado de 2 + 2?',
      'multiple_choice',
      'easy',
      1,
      v_admin_id
    )
    returning id into v_question_id;
    
    -- Opciones para la pregunta
    if v_question_id is not null then
      insert into public.question_bank_options (question_id, option_text, is_correct, order_index)
      values 
        (v_question_id, '3', false, 1),
        (v_question_id, '4', true, 2),
        (v_question_id, '5', false, 3),
        (v_question_id, '6', false, 4);
    end if;
  end if;
  
  -- Rúbrica demo
  if v_subject_id is not null and v_admin_id is not null then
    insert into public.rubrics (name, description, subject_id, criteria, created_by)
    values (
      'Evaluación Matemáticas Básicas',
      'Rúbrica para evaluar conocimientos básicos de matemáticas',
      v_subject_id,
      '[{"criterion":"Precisión","weight":40},{"criterion":"Procedimiento","weight":35},{"criterion":"Presentación","weight":25}]'::jsonb,
      v_admin_id
    );
  end if;
  
  -- Beca demo
  if v_admin_id is not null then
    insert into public.scholarships (name, description, scholarship_type, discount_percentage, created_by)
    values (
      'Beca Excelencia Académica',
      'Beca para estudiantes con promedio superior a 4.5',
      'academic',
      50,
      v_admin_id
    );
  end if;
end $$;

-- Seeds para Etapa 4
do $$
declare
  v_admin_id uuid;
begin
  select user_id into v_admin_id from public.platform_admins limit 1;
  
  -- Insignias demo
  if v_admin_id is not null then
    insert into public.badges (name, description, badge_type, points_value)
    values 
      ('Primera Tarea Completada', 'Completaste tu primera tarea', 'achievement', 10),
      ('Asistencia Perfecta', 'Un mes sin faltas', 'excellence', 25),
      ('Participación Activa', 'Participaste en clase 10 veces', 'participation', 15);
  end if;
end $$;
end;