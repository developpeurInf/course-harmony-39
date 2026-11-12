-- =====================================================================
-- Trois manques comblés pour les professeurs
--
--   A. Correction des réponses rédigées (short_answer) par l'enseignant :
--      grade_quiz_answers() note une ou plusieurs réponses et recalcule la note
--      de chaque copie ; le corrigé de l'élève affiche la note et le commentaire.
--   B. Remise des exercices par les élèves : table exercise_submissions,
--      bucket privé « exercise-submissions », submit_exercise() (élève) et
--      review_exercise_submission() (professeur : note, commentaire, copie corrigée).
--   C. Copier un quiz / un examen (questions et réponses comprises) vers un
--      autre cours, d'une autre classe ou de la même : duplicate_exam().
--   D. Habilitations « quiz.grade » et « exercise.review » (src/lib/permissions.ts),
--      accordées aux offres qui ont déjà « quiz.results_view » / « exercise.edit ».
--
-- À exécuter à la main dans le SQL Editor de Supabase. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Utilitaire : texte → uuid sans erreur (chemins de fichiers)
-- ---------------------------------------------------------------------
create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- Nombre sans zéros inutiles : 15.50 → « 15.5 », 20.00 → « 20 »
create or replace function public.short_number(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p = trunc(p) then trunc(p)::text else rtrim(p::text, '0') end
$$;

-- =====================================================================
-- A. Correction des réponses rédigées
-- =====================================================================
alter table public.quiz_answers add column if not exists graded_at timestamptz;
alter table public.quiz_answers add column if not exists graded_by uuid;
alter table public.quiz_answers add column if not exists teacher_comment text;

-- p_grades : [{ "answer_id": uuid, "points": number, "comment": text|null }]
-- Retour   : [{ "submission_id": uuid, "score": number }] (copies recalculées)
create or replace function public.grade_quiz_answers(p_grades jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  g jsonb;
  v_row record;
  v_max numeric;
  v_points numeric;
  v_subs uuid[] := '{}';
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if jsonb_typeof(p_grades) is distinct from 'array' or jsonb_array_length(p_grades) = 0 then
    raise exception 'INVALID_GRADES' using errcode = '22023';
  end if;
  if jsonb_array_length(p_grades) > 500 then
    raise exception 'TOO_MANY_GRADES' using errcode = '22023';
  end if;
  if public.is_professor(v_uid) and not public.has_permission('quiz.grade', v_uid) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  for g in select value from jsonb_array_elements(p_grades)
  loop
    select a.id, a.submission_id, q.question_type, q.points, c.professor_id
      into v_row
    from public.quiz_answers a
    join public.quiz_submissions s on s.id = a.submission_id
    join public.quiz_questions q on q.id = a.question_id
    join public.exams e on e.id = s.exam_id
    join public.courses c on c.id = e.course_id
    where a.id = public.try_uuid(g ->> 'answer_id');

    if v_row.id is null then
      raise exception 'ANSWER_NOT_FOUND' using errcode = '42501';
    end if;
    if v_row.professor_id is distinct from v_uid and not public.is_admin(v_uid) then
      raise exception 'ACCESS_DENIED' using errcode = '42501';
    end if;
    if v_row.question_type <> 'short_answer' then
      raise exception 'NOT_A_SHORT_ANSWER' using errcode = '22023';
    end if;

    v_max := coalesce(nullif(v_row.points, 0), 1);
    begin
      v_points := (g ->> 'points')::numeric;
    exception when others then
      raise exception 'INVALID_POINTS' using errcode = '22023';
    end;
    if v_points is null then
      raise exception 'INVALID_POINTS' using errcode = '22023';
    end if;
    -- demi-points au plus fin, entre 0 et le barème de la question
    v_points := greatest(0, least(v_max, round(v_points * 2) / 2));

    update public.quiz_answers
       set points_earned = v_points,
           is_correct = (v_points >= v_max),
           graded_at = now(),
           graded_by = v_uid,
           teacher_comment = nullif(left(btrim(coalesce(g ->> 'comment', '')), 2000), '')
     where id = v_row.id;

    if not (v_row.submission_id = any (v_subs)) then
      v_subs := v_subs || v_row.submission_id;
    end if;
  end loop;

  update public.quiz_submissions s
     set score = coalesce((select sum(a.points_earned) from public.quiz_answers a where a.submission_id = s.id), 0)
   where s.id = any (v_subs);

  return coalesce((
    select jsonb_agg(jsonb_build_object('submission_id', s.id, 'score', s.score))
    from public.quiz_submissions s
    where s.id = any (v_subs)
  ), '[]'::jsonb);
end $$;

revoke all on function public.grade_quiz_answers(jsonb) from public, anon;
grant execute on function public.grade_quiz_answers(jsonb) to authenticated;

-- Corrigé élève : mêmes données qu'avant + note / commentaire de l'enseignant
create or replace function public.quiz_review_for_student(p_submission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_sub record;
  v_settings jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select s.id, s.exam_id, s.student_id, s.score, s.total_points, s.submitted_at
    into v_sub
  from public.quiz_submissions s
  where s.id = p_submission_id;
  if v_sub.id is null or v_sub.student_id is distinct from v_uid then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;

  select public.quiz_settings_from_description(e.description) into v_settings
  from public.exams e
  where e.id = v_sub.exam_id;
  if not (coalesce(public.quiz_setting_flag(v_settings, 'showResultsImmediately'), true)
          and coalesce(public.quiz_setting_flag(v_settings, 'allowReview'), true)) then
    raise exception 'REVIEW_NOT_ALLOWED' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'submission_id', v_sub.id,
    'exam_id', v_sub.exam_id,
    'score', v_sub.score,
    'total_points', v_sub.total_points,
    'submitted_at', v_sub.submitted_at,
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'question_id', a.question_id,
               'selected_option_id', a.selected_option_id,
               'text_answer', a.text_answer,
               'is_correct', a.is_correct,
               'points_earned', a.points_earned,
               'graded_at', a.graded_at,
               'teacher_comment', a.teacher_comment))
      from public.quiz_answers a
      where a.submission_id = v_sub.id
    ), '[]'::jsonb),
    'correct_option_ids', coalesce((
      select jsonb_agg(o.id)
      from public.quiz_options o
      join public.quiz_questions q on q.id = o.question_id
      where q.exam_id = v_sub.exam_id and o.is_correct is true
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.quiz_review_for_student(uuid) from public, anon;
grant execute on function public.quiz_review_for_student(uuid) to authenticated;

-- =====================================================================
-- B. Remise des exercices
-- =====================================================================

-- Une ligne par élève et par exercice. Les fichiers sont décrits en JSON :
--   [{ "path": "<exercise_id>/<student_id>/…", "name": "…", "size": 123, "mime": "image/jpeg" }]
-- Les copies corrigées du professeur sont rangées sous « <exercise_id>/<student_id>/correction/… ».
create table if not exists public.exercise_submissions (
  id               uuid primary key default gen_random_uuid(),
  exercise_id      uuid not null references public.exercises(id) on delete cascade,
  student_id       uuid not null references auth.users(id) on delete cascade,
  files            jsonb not null default '[]'::jsonb,
  student_note     text,
  submitted_at     timestamptz not null default now(),
  is_late          boolean not null default false,
  status           text not null default 'submitted' check (status in ('submitted', 'returned')),
  grade            numeric(5,2),
  max_grade        numeric(5,2) not null default 20,
  feedback         text,
  correction_files jsonb not null default '[]'::jsonb,
  returned_at      timestamptz,
  returned_by      uuid,
  unique (exercise_id, student_id)
);

create index if not exists idx_exercise_submissions_student on public.exercise_submissions (student_id);

alter table public.exercise_submissions enable row level security;
grant select on public.exercise_submissions to authenticated;

-- Lecture seulement : toutes les écritures passent par les fonctions ci-dessous
drop policy if exists "Exercise submissions readable" on public.exercise_submissions;
create policy "Exercise submissions readable" on public.exercise_submissions
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select public.is_admin())
    or public.can_access_exercise(exercise_id, true)
  );

-- Remise (ou nouvelle remise) par l'élève, tant que la copie n'a pas été rendue corrigée
create or replace function public.submit_exercise(p_exercise_id uuid, p_files jsonb, p_note text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_due timestamptz;
  v_prefix text;
  f jsonb;
  v_files jsonb := '[]'::jsonb;
  v_status text;
  v_row public.exercise_submissions;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if public.is_professor(v_uid) or not public.can_access_exercise(p_exercise_id, false) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_files) is distinct from 'array'
     or jsonb_array_length(p_files) = 0
     or jsonb_array_length(p_files) > 15 then
    raise exception 'INVALID_FILES' using errcode = '22023';
  end if;

  v_prefix := p_exercise_id::text || '/' || v_uid::text || '/';
  for f in select value from jsonb_array_elements(p_files)
  loop
    if jsonb_typeof(f) <> 'object'
       or left(coalesce(f ->> 'path', ''), length(v_prefix)) <> v_prefix
       or position('/correction/' in (f ->> 'path')) > 0
       or position('..' in (f ->> 'path')) > 0 then
      raise exception 'INVALID_FILE_PATH' using errcode = '22023';
    end if;
    v_files := v_files || jsonb_build_object(
      'path', f ->> 'path',
      'name', left(coalesce(nullif(f ->> 'name', ''), 'copie'), 200),
      'size', case when jsonb_typeof(f -> 'size') = 'number' then f -> 'size' else 'null'::jsonb end,
      'mime', left(coalesce(f ->> 'mime', ''), 100));
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_exercise_id::text, 1));

  select s.status into v_status
  from public.exercise_submissions s
  where s.exercise_id = p_exercise_id and s.student_id = v_uid;
  if v_status = 'returned' then
    raise exception 'ALREADY_RETURNED' using errcode = 'P0001';
  end if;

  select e.due_date into v_due from public.exercises e where e.id = p_exercise_id;

  insert into public.exercise_submissions (exercise_id, student_id, files, student_note, submitted_at, is_late, status)
  values (p_exercise_id, v_uid, v_files, nullif(left(btrim(coalesce(p_note, '')), 2000), ''), now(),
          v_due is not null and now() > v_due, 'submitted')
  on conflict (exercise_id, student_id) do update
    set files = excluded.files,
        student_note = excluded.student_note,
        submitted_at = excluded.submitted_at,
        is_late = excluded.is_late
  returning * into v_row;

  return to_jsonb(v_row);
end $$;

revoke all on function public.submit_exercise(uuid, jsonb, text) from public, anon;
grant execute on function public.submit_exercise(uuid, jsonb, text) to authenticated;

-- Correction par le professeur.
--   p_return = true  → copie rendue à l'élève (notification), l'élève ne peut plus la modifier ;
--   p_return = false → brouillon de correction, ou copie rouverte pour une nouvelle remise.
create or replace function public.review_exercise_submission(
  p_submission_id uuid,
  p_grade numeric,
  p_max_grade numeric default 20,
  p_feedback text default null,
  p_correction_files jsonb default '[]'::jsonb,
  p_return boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.exercise_submissions;
  v_title text;
  v_course uuid;
  v_prefix text;
  f jsonb;
  v_files jsonb := '[]'::jsonb;
  v_max numeric;
  v_grade numeric;
  v_row public.exercise_submissions;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_sub from public.exercise_submissions where id = p_submission_id;
  if v_sub.id is null then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  if not public.can_access_exercise(v_sub.exercise_id, true) and not public.is_admin(v_uid) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if public.is_professor(v_uid) and not public.has_permission('exercise.review', v_uid) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_max := greatest(1, least(100, coalesce(p_max_grade, 20)));
  v_grade := case when p_grade is null then null else greatest(0, least(v_max, round(p_grade * 4) / 4)) end;

  if jsonb_typeof(coalesce(p_correction_files, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_correction_files, '[]'::jsonb)) > 15 then
    raise exception 'INVALID_FILES' using errcode = '22023';
  end if;
  v_prefix := v_sub.exercise_id::text || '/' || v_sub.student_id::text || '/correction/';
  for f in select value from jsonb_array_elements(coalesce(p_correction_files, '[]'::jsonb))
  loop
    if jsonb_typeof(f) <> 'object'
       or left(coalesce(f ->> 'path', ''), length(v_prefix)) <> v_prefix
       or position('..' in (f ->> 'path')) > 0 then
      raise exception 'INVALID_FILE_PATH' using errcode = '22023';
    end if;
    v_files := v_files || jsonb_build_object(
      'path', f ->> 'path',
      'name', left(coalesce(nullif(f ->> 'name', ''), 'correction'), 200),
      'size', case when jsonb_typeof(f -> 'size') = 'number' then f -> 'size' else 'null'::jsonb end,
      'mime', left(coalesce(f ->> 'mime', ''), 100));
  end loop;

  update public.exercise_submissions
     set grade = v_grade,
         max_grade = v_max,
         feedback = nullif(left(btrim(coalesce(p_feedback, '')), 4000), ''),
         correction_files = v_files,
         status = case when p_return then 'returned' else 'submitted' end,
         returned_at = case when p_return then now() else null end,
         returned_by = case when p_return then v_uid else null end
   where id = v_sub.id
  returning * into v_row;

  -- Notification à l'élève quand la copie lui est rendue (première fois ou mise à jour)
  if p_return then
    select e.title, e.course_id into v_title, v_course from public.exercises e where e.id = v_sub.exercise_id;
    begin
      insert into public.notifications (user_id, title, message, type, course_id, exercise_id)
      values (v_sub.student_id,
              'Copie corrigée · تم تصحيح الورقة',
              coalesce(v_title, 'Exercice')
                || case when v_grade is not null
                        then ' : ' || public.short_number(v_grade) || '/' || public.short_number(v_max)
                        else '' end,
              'info', v_course, v_sub.exercise_id);
    exception when others then
      null; -- la correction reste enregistrée même si la notification échoue
    end;
  end if;

  return to_jsonb(v_row);
end $$;

revoke all on function public.review_exercise_submission(uuid, numeric, numeric, text, jsonb, boolean) from public, anon;
grant execute on function public.review_exercise_submission(uuid, numeric, numeric, text, jsonb, boolean) to authenticated;

-- Bucket privé des copies (15 Mo par fichier, images et PDF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-submissions', 'exercise-submissions', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Chemins : <exercise_id>/<student_id>/<fichier>  ou  <exercise_id>/<student_id>/correction/<fichier>
drop policy if exists "Exercise submission files readable" on storage.objects;
create policy "Exercise submission files readable" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'exercise-submissions'
    and (
      (select public.is_admin())
      or public.can_access_exercise(public.try_uuid((storage.foldername(name))[1]), true)
      or (
        (storage.foldername(name))[2] = (select auth.uid())::text
        and public.can_access_exercise(public.try_uuid((storage.foldername(name))[1]), false)
      )
    )
  );

drop policy if exists "Exercise submission files insert" on storage.objects;
create policy "Exercise submission files insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'exercise-submissions'
    and (
      -- élève : son propre dossier, hors « correction »
      (
        (storage.foldername(name))[2] = (select auth.uid())::text
        and coalesce((storage.foldername(name))[3], '') <> 'correction'
        and not (select public.is_professor())
        and public.can_access_exercise(public.try_uuid((storage.foldername(name))[1]), false)
      )
      -- professeur du cours : dossier « correction » d'un élève
      or (
        (storage.foldername(name))[3] = 'correction'
        and public.can_access_exercise(public.try_uuid((storage.foldername(name))[1]), true)
      )
    )
  );

drop policy if exists "Exercise submission files delete" on storage.objects;
create policy "Exercise submission files delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'exercise-submissions'
    and (
      (
        (storage.foldername(name))[2] = (select auth.uid())::text
        and coalesce((storage.foldername(name))[3], '') <> 'correction'
        and not (select public.is_professor())
      )
      or (
        (storage.foldername(name))[3] = 'correction'
        and public.can_access_exercise(public.try_uuid((storage.foldername(name))[1]), true)
      )
    )
  );

-- =====================================================================
-- C. Copier un quiz / un examen vers un autre cours
--    La copie est créée masquée : le professeur vérifie les dates puis la publie.
--    Toutes les colonnes sont recopiées (même celles ajoutées plus tard).
-- =====================================================================
create or replace function public.duplicate_exam(p_exam_id uuid, p_target_course_id uuid, p_title text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_exam public.exams;
  v_src_prof uuid;
  v_dst_prof uuid;
  v_new uuid := gen_random_uuid();
  v_q public.quiz_questions;
  v_new_q uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_exam from public.exams where id = p_exam_id;
  if v_exam.id is null then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  select c.professor_id into v_src_prof from public.courses c where c.id = v_exam.course_id;
  select c.professor_id into v_dst_prof from public.courses c where c.id = p_target_course_id;
  if v_dst_prof is null then
    raise exception 'TARGET_NOT_FOUND' using errcode = '42501';
  end if;
  if not public.is_admin(v_uid) and (v_src_prof is distinct from v_uid or v_dst_prof is distinct from v_uid) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if public.is_professor(v_uid) and not public.has_permission(
       case when v_exam.type::text = 'quiz' then 'quiz.edit' else 'exam.edit' end, v_uid) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  insert into public.exams
  select (jsonb_populate_record(null::public.exams, to_jsonb(v_exam) || jsonb_build_object(
    'id', v_new,
    'course_id', p_target_course_id,
    'title', coalesce(nullif(btrim(p_title), ''), v_exam.title),
    'is_visible', false,
    'created_at', now(),
    'updated_at', now()))).*;

  for v_q in
    select * from public.quiz_questions where exam_id = p_exam_id order by question_order, id
  loop
    v_new_q := gen_random_uuid();
    insert into public.quiz_questions
    select (jsonb_populate_record(null::public.quiz_questions, to_jsonb(v_q) || jsonb_build_object(
      'id', v_new_q, 'exam_id', v_new, 'created_at', now(), 'updated_at', now()))).*;

    insert into public.quiz_options
    select (jsonb_populate_record(null::public.quiz_options, to_jsonb(o) || jsonb_build_object(
      'id', gen_random_uuid(), 'question_id', v_new_q, 'created_at', now()))).*
    from public.quiz_options o
    where o.question_id = v_q.id;
  end loop;

  return v_new;
end $$;

revoke all on function public.duplicate_exam(uuid, uuid, text) from public, anon;
grant execute on function public.duplicate_exam(uuid, uuid, text) to authenticated;

-- =====================================================================
-- D. Habilitations
-- =====================================================================
do $$
begin
  if to_regclass('public.permissions') is null then
    raise notice 'table permissions absente : habilitations non ajoutées';
    return;
  end if;

  insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
    ('exercise.review', 'exercise', 'Recevoir et corriger les copies d''exercices', 'استلام وتصحيح أوراق التمارين', 'Receive and grade exercise submissions', 'feature', true, 215),
    ('quiz.grade', 'quiz', 'Corriger les réponses rédigées', 'تصحيح الإجابات المكتوبة', 'Grade written answers', 'feature', true, 275)
  on conflict (key) do nothing;

  -- Mêmes offres que les fonctions voisines
  insert into public.plan_permissions (plan_id, permission_key, limit_value)
  select pp.plan_id, 'quiz.grade', null
  from public.plan_permissions pp
  where pp.permission_key = 'quiz.results_view'
    and not exists (select 1 from public.plan_permissions x where x.plan_id = pp.plan_id and x.permission_key = 'quiz.grade');

  insert into public.plan_permissions (plan_id, permission_key, limit_value)
  select pp.plan_id, 'exercise.review', null
  from public.plan_permissions pp
  where pp.permission_key = 'exercise.edit'
    and not exists (select 1 from public.plan_permissions x where x.plan_id = pp.plan_id and x.permission_key = 'exercise.review');
end $$;

notify pgrst, 'reload schema';
