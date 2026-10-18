-- =====================================================================
-- Quiz : verrouillage (2e étape de la correction côté serveur)
-- À exécuter APRÈS la mise en ligne du nouveau front (qui passe par
-- quiz_options_for_student / submit_quiz_attempt). Idempotent.
-- =====================================================================
-- ---------------------------------------------------------------------
-- 7. quiz_options : lecture directe réservée au professeur du cours et aux admins
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  if to_regclass('public.quiz_options') is null then
    return;
  end if;

  execute 'drop policy if exists "Quiz options viewable by everyone" on public.quiz_options';
  -- Toute autre règle de lecture « ouverte à tous » (renommée) est aussi retirée
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'quiz_options'
      and permissive = 'PERMISSIVE' and cmd = 'SELECT'
      and btrim(coalesce(qual, '')) in ('true', '(true)')
  loop
    execute format('drop policy %I on public.quiz_options', r.policyname);
  end loop;

  execute 'drop policy if exists "Quiz options readable by course professor or admin" on public.quiz_options';
  execute $p$
    create policy "Quiz options readable by course professor or admin"
    on public.quiz_options
    for select
    to authenticated
    using (
      (select public.is_admin())
      or exists (
        select 1
        from public.quiz_questions q
        join public.exams e on e.id = q.exam_id
        join public.courses c on c.id = e.course_id
        where q.id = quiz_options.question_id
          and c.professor_id = (select auth.uid())
      )
    )
  $p$;
end $$;

-- ---------------------------------------------------------------------
-- 8. quiz_submissions / quiz_answers : plus d'écriture directe par les élèves
--    On retire les règles PERMISSIVES d'écriture (INSERT / UPDATE / DELETE / ALL)
--    qui ne concernent pas le professeur du cours ni les admins ; les règles
--    des professeurs (qui citent courses / professor / is_admin) sont gardées.
--    La lecture de ses propres copies est (re)garantie juste après.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('quiz_submissions', 'quiz_answers')
      and permissive = 'PERMISSIVE'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) !~* '(professor|courses|is_admin)'
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    raise notice 'règle supprimée : % sur public.%', r.policyname, r.tablename;
  end loop;

  if to_regclass('public.quiz_submissions') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'quiz_submissions'
         and permissive = 'PERMISSIVE' and cmd = 'SELECT'
         and coalesce(qual, '') ~* 'student_id'
     ) then
    execute $p$
      create policy "Students read own quiz submissions"
      on public.quiz_submissions
      for select
      to authenticated
      using (student_id = (select auth.uid()))
    $p$;
  end if;

  if to_regclass('public.quiz_answers') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'quiz_answers'
         and permissive = 'PERMISSIVE' and cmd = 'SELECT'
         and coalesce(qual, '') ~* 'student_id'
     ) then
    execute $p$
      create policy "Students read own quiz answers"
      on public.quiz_answers
      for select
      to authenticated
      using (exists (
        select 1 from public.quiz_submissions s
        where s.id = quiz_answers.submission_id
          and s.student_id = (select auth.uid())
      ))
    $p$;
  end if;
end $$;

-- Recharge le cache de schéma de l'API (clés étrangères, nouvelles fonctions)
notify pgrst, 'reload schema';
