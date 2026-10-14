-- =====================================================================
-- Performances : index sur les clés étrangères / filtres fréquents
-- et règles « hab: » réécrites avec le motif initPlan.
--
-- * Idempotent : peut être exécuté plusieurs fois sans erreur.
-- * Sûr : chaque index n'est créé que si la table ET les colonnes existent
--   (information_schema.columns) ; chaque règle seulement si la table existe.
-- * Les règles « hab: » sont identiques à celles de
--   20261012120000_admin_subscriptions.sql et 20261013120000_access_realtime.sql
--   (même nom, même commande, même rôle, même logique) ; seuls les appels de
--   fonctions sont enveloppés dans (select …) pour que PostgreSQL les évalue
--   UNE fois par requête au lieu d'une fois par ligne.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Index
-- ---------------------------------------------------------------------
do $$
declare
  spec record;
  missing int;
begin
  for spec in
    select * from (values
      ('idx_quiz_answers_submission_id',        'quiz_answers',       array['submission_id'],             'submission_id'),
      ('idx_quiz_answers_question_id',          'quiz_answers',       array['question_id'],               'question_id'),
      ('idx_quiz_submissions_exam_id',          'quiz_submissions',   array['exam_id'],                   'exam_id'),
      ('idx_quiz_submissions_student_exam',     'quiz_submissions',   array['student_id','exam_id'],      'student_id, exam_id'),
      ('idx_quiz_questions_exam_order',         'quiz_questions',     array['exam_id','question_order'],  'exam_id, question_order'),
      ('idx_quiz_options_question_order',       'quiz_options',       array['question_id','option_order'],'question_id, option_order'),
      ('idx_exams_course_id',                   'exams',              array['course_id'],                 'course_id'),
      ('idx_exercises_course_id',               'exercises',          array['course_id'],                 'course_id'),
      ('idx_courses_room_id',                   'courses',            array['room_id'],                   'room_id'),
      ('idx_courses_professor_id',              'courses',            array['professor_id'],              'professor_id'),
      ('idx_enrollments_student_id',            'enrollments',        array['student_id'],                'student_id'),
      ('idx_enrollments_course_id',             'enrollments',        array['course_id'],                 'course_id'),
      ('idx_enrollments_room_id',               'enrollments',        array['room_id'],                   'room_id'),
      ('idx_profiles_room_id',                  'profiles',           array['room_id'],                   'room_id'),
      ('idx_notifications_user_created',        'notifications',      array['user_id','created_at'],      'user_id, created_at desc'),
      ('idx_student_sessions_student_active',   'student_sessions',   array['student_id','is_active'],    'student_id, is_active'),
      ('idx_student_sessions_room_active',      'student_sessions',   array['room_id','is_active'],       'room_id, is_active'),
      ('idx_course_materials_course_id',        'course_materials',   array['course_id'],                 'course_id'),
      ('idx_student_activities_student_id',     'student_activities', array['student_id'],                'student_id')
    ) as t(idx_name, tbl, cols, expr)
  loop
    select count(*) into missing
    from unnest(spec.cols) as c(col)
    where not exists (
      select 1 from information_schema.columns ic
      where ic.table_schema = 'public' and ic.table_name = spec.tbl and ic.column_name = c.col
    );
    if missing = 0 then
      execute format('create index if not exists %I on public.%I (%s)', spec.idx_name, spec.tbl, spec.expr);
    else
      raise notice 'index % ignoré : table public.% ou colonne(s) absente(s)', spec.idx_name, spec.tbl;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Règles « hab: » (RESTRICTIVES) avec appels de fonctions en initPlan
-- ---------------------------------------------------------------------
do $$
declare
  spec record;
begin
  -- les fonctions d'habilitation doivent exister (migration « abonnements » appliquée)
  if to_regprocedure('public.is_professor(uuid)') is null
     or to_regprocedure('public.has_permission(text, uuid)') is null then
    raise notice 'fonctions is_professor / has_permission absentes : règles « hab: » non modifiées';
    return;
  end if;

  for spec in
    select * from (values
      -- Classes
      ('hab: voir classes',          'rooms',            'select', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''class.view'')))'),
      ('hab: creer classe',          'rooms',            'insert', 'with check',
       '(not (select public.is_professor()) or (select public.has_permission(''class.create'')))'),
      ('hab: modifier classe',       'rooms',            'update', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''class.edit'')))'),
      ('hab: supprimer classe',      'rooms',            'delete', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''class.delete'')))'),
      -- Cours
      ('hab: voir cours',            'courses',          'select', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''course.view'')))'),
      ('hab: creer cours',           'courses',          'insert', 'with check',
       '(not (select public.is_professor()) or (select public.has_permission(''course.edit'')))'),
      ('hab: modifier cours',        'courses',          'update', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''course.edit'')))'),
      ('hab: supprimer cours',       'courses',          'delete', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''course.delete'')))'),
      -- Supports de cours
      ('hab: supprimer support',     'course_materials', 'delete', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''course.edit'')))'),
      -- Exercices
      ('hab: creer exercice',        'exercises',        'insert', 'with check',
       '(not (select public.is_professor()) or (select public.has_permission(''exercise.edit'')))'),
      ('hab: modifier exercice',     'exercises',        'update', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''exercise.edit'')))'),
      ('hab: supprimer exercice',    'exercises',        'delete', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''exercise.edit'')))'),
      -- Quiz et examens (la permission dépend du type de la ligne : chaque appel reste en initPlan)
      ('hab: creer quiz examen',     'exams',            'insert', 'with check',
       '(not (select public.is_professor()) or (case when type::text = ''exam'' then (select public.has_permission(''exam.edit'')) else (select public.has_permission(''quiz.edit'')) end))'),
      ('hab: modifier quiz examen',  'exams',            'update', 'using',
       '(not (select public.is_professor()) or (case when type::text = ''exam'' then (select public.has_permission(''exam.edit'')) else (select public.has_permission(''quiz.edit'')) end))'),
      ('hab: supprimer quiz examen', 'exams',            'delete', 'using',
       '(not (select public.is_professor()) or (case when type::text = ''exam'' then (select public.has_permission(''exam.edit'')) else (select public.has_permission(''quiz.edit'')) end))'),
      -- Questions
      ('hab: creer question',        'quiz_questions',   'insert', 'with check',
       '(not (select public.is_professor()) or (select public.has_permission(''quiz.edit'')) or (select public.has_permission(''exam.edit'')))'),
      ('hab: modifier question',     'quiz_questions',   'update', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''quiz.edit'')) or (select public.has_permission(''exam.edit'')))'),
      ('hab: supprimer question',    'quiz_questions',   'delete', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''quiz.edit'')) or (select public.has_permission(''exam.edit'')))'),
      -- Options
      ('hab: creer option',          'quiz_options',     'insert', 'with check',
       '(not (select public.is_professor()) or (select public.has_permission(''quiz.edit'')) or (select public.has_permission(''exam.edit'')))'),
      ('hab: modifier option',       'quiz_options',     'update', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''quiz.edit'')) or (select public.has_permission(''exam.edit'')))'),
      ('hab: supprimer option',      'quiz_options',     'delete', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''quiz.edit'')) or (select public.has_permission(''exam.edit'')))')
    ) as t(pol, tbl, cmd, clause, expr)
  loop
    if to_regclass(format('public.%I', spec.tbl)) is null then
      raise notice 'règle « % » ignorée : table public.% absente', spec.pol, spec.tbl;
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', spec.pol, spec.tbl);
    execute format('create policy %I on public.%I as restrictive for %s to authenticated %s %s',
                   spec.pol, spec.tbl, spec.cmd, spec.clause, spec.expr);
  end loop;
end $$;
