-- ================= 20261028120000_grading_submissions_copy.sql =================
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

-- ================= 20261029090000_class_followup.sql =================
-- =====================================================================
-- Suivi de classe (lot 1 des propositions pour les professeurs)
--
--   A. Appel des présences : table attendance (une ligne par élève, séance et jour).
--   B. Groupes de besoin : student_need_groups (consolider / en cours / maîtrisé).
--   C. Appréciations des bulletins : student_appreciations (une par élève et période).
--   D. Résumé du lundi : teacher_weekly_digest() → une notification par professeur
--      (copies à corriger, élèves inactifs, absences de la semaine), planifiée avec pg_cron.
--   E. Habilitations « attendance.manage », « student.groups », « student.appreciations »,
--      « reports.parent_report » (src/lib/permissions.ts).
--
-- À exécuter à la main dans le SQL Editor de Supabase, APRÈS
-- 20261028120000_grading_submissions_copy.sql. Idempotent.
-- =====================================================================

-- Le professeur propriétaire d'une classe (ou un admin)
create or replace function public.owns_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.rooms r where r.id = p_room_id and r.professor_id = auth.uid())
      or public.is_admin(auth.uid())
$$;
revoke all on function public.owns_room(uuid) from public, anon;
grant execute on function public.owns_room(uuid) to authenticated;

-- =====================================================================
-- A. Présences
-- =====================================================================
create table if not exists public.attendance (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  student_id   uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  -- numéro de la séance dans la journée (1 = première heure de cours avec cette classe)
  slot         smallint not null default 1 check (slot between 1 and 12),
  status       text not null check (status in ('present', 'absent', 'late', 'excused')),
  note         text,
  recorded_by  uuid,
  recorded_at  timestamptz not null default now(),
  unique (room_id, student_id, session_date, slot)
);
create index if not exists idx_attendance_room_date on public.attendance (room_id, session_date);
create index if not exists idx_attendance_student on public.attendance (student_id, session_date);

alter table public.attendance enable row level security;
grant select, insert, update, delete on public.attendance to authenticated;

drop policy if exists "Attendance readable" on public.attendance;
create policy "Attendance readable" on public.attendance
  for select to authenticated
  using (student_id = (select auth.uid()) or public.owns_room(room_id));

drop policy if exists "Attendance managed by room professor" on public.attendance;
create policy "Attendance managed by room professor" on public.attendance
  for all to authenticated
  using (public.owns_room(room_id))
  with check (public.owns_room(room_id));

-- =====================================================================
-- B. Groupes de besoin
-- =====================================================================
create table if not exists public.student_need_groups (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  grp        text not null check (grp in ('consolidate', 'progress', 'mastered')),
  updated_at timestamptz not null default now(),
  primary key (room_id, student_id)
);
alter table public.student_need_groups enable row level security;
grant select, insert, update, delete on public.student_need_groups to authenticated;

drop policy if exists "Need groups managed by room professor" on public.student_need_groups;
create policy "Need groups managed by room professor" on public.student_need_groups
  for all to authenticated
  using (public.owns_room(room_id))
  with check (public.owns_room(room_id));

-- =====================================================================
-- C. Appréciations
-- =====================================================================
create table if not exists public.student_appreciations (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  -- période libre : « S1 », « S2 », « T1 »…
  term       text not null default 'S1',
  text       text not null,
  updated_at timestamptz not null default now(),
  primary key (room_id, student_id, term)
);
alter table public.student_appreciations enable row level security;
grant select, insert, update, delete on public.student_appreciations to authenticated;

drop policy if exists "Appreciations managed by room professor" on public.student_appreciations;
create policy "Appreciations managed by room professor" on public.student_appreciations
  for all to authenticated
  using (public.owns_room(room_id))
  with check (public.owns_room(room_id));

-- Règles « hab: » (RESTRICTIVES) : écriture réservée aux offres qui incluent la fonction
do $$
declare
  spec record;
begin
  if to_regprocedure('public.is_professor(uuid)') is null
     or to_regprocedure('public.has_permission(text, uuid)') is null then
    raise notice 'fonctions is_professor / has_permission absentes : règles « hab: » non créées';
    return;
  end if;
  for spec in
    select * from (values
      ('attendance', 'attendance.manage'),
      ('student_need_groups', 'student.groups'),
      ('student_appreciations', 'student.appreciations')
    ) as t(tbl, perm)
  loop
    execute format('drop policy if exists %I on public.%I', 'hab: ecrire ' || spec.tbl || ' (insert)', spec.tbl);
    execute format('drop policy if exists %I on public.%I', 'hab: ecrire ' || spec.tbl || ' (update)', spec.tbl);
    execute format('drop policy if exists %I on public.%I', 'hab: ecrire ' || spec.tbl || ' (delete)', spec.tbl);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (not (select public.is_professor()) or (select public.has_permission(%L)))',
                   'hab: ecrire ' || spec.tbl || ' (insert)', spec.tbl, spec.perm);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (not (select public.is_professor()) or (select public.has_permission(%L)))',
                   'hab: ecrire ' || spec.tbl || ' (update)', spec.tbl, spec.perm);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (not (select public.is_professor()) or (select public.has_permission(%L)))',
                   'hab: ecrire ' || spec.tbl || ' (delete)', spec.tbl, spec.perm);
  end loop;
end $$;

-- =====================================================================
-- D. Résumé du lundi
-- =====================================================================
-- Compteurs de la semaine d'un professeur (tableau de bord et résumé du lundi)
create or replace function public.teacher_week_counts(p_prof uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_short int := 0;
  v_copies int := 0;
  v_inactive int := 0;
  v_absences int := 0;
  v_late int := 0;
begin
  -- Réponses rédigées pas encore corrigées
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'quiz_answers' and column_name = 'graded_at') then
    execute $q$
      select count(*)
      from public.quiz_answers a
      join public.quiz_questions q on q.id = a.question_id and q.question_type = 'short_answer'
      join public.exams e on e.id = q.exam_id
      join public.courses c on c.id = e.course_id
      where c.professor_id = $1 and a.graded_at is null and nullif(btrim(coalesce(a.text_answer, '')), '') is not null
    $q$ into v_short using p_prof;
  end if;

  -- Copies d'exercices rendues, pas encore corrigées
  if to_regclass('public.exercise_submissions') is not null then
    execute $q$
      select count(*)
      from public.exercise_submissions s
      join public.exercises x on x.id = s.exercise_id
      join public.courses c on c.id = x.course_id
      where c.professor_id = $1 and s.status = 'submitted'
    $q$ into v_copies using p_prof;
  end if;

  -- Élèves sans connexion depuis 7 jours
  select count(*) into v_inactive
  from public.profiles st
  join public.rooms r on r.id = st.room_id and r.professor_id = p_prof
  where st.role = 'student'
    and not exists (
      select 1 from public.student_sessions ss
      where ss.student_id = st.id and ss.last_activity > now() - interval '7 days'
    );

  -- Absences et retards des 7 derniers jours
  select count(*) filter (where a.status = 'absent'), count(*) filter (where a.status = 'late')
    into v_absences, v_late
  from public.attendance a
  join public.rooms r on r.id = a.room_id and r.professor_id = p_prof
  where a.session_date > current_date - 7;

  return jsonb_build_object(
    'short_answers', v_short,
    'exercise_copies', v_copies,
    'inactive_students', v_inactive,
    'absences', v_absences,
    'lates', v_late
  );
end $$;
revoke all on function public.teacher_week_counts(uuid) from public, anon, authenticated;

-- Pour le tableau de bord du professeur connecté
create or replace function public.my_week_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_professor(auth.uid()) or public.is_admin(auth.uid())
              then public.teacher_week_counts(auth.uid())
              else '{}'::jsonb end
$$;
revoke all on function public.my_week_summary() from public, anon;
grant execute on function public.my_week_summary() to authenticated;

-- Résumé du lundi : une notification par professeur dont la semaine n'est pas « vide ».
-- Retourne le nombre de notifications envoyées.
create or replace function public.teacher_weekly_digest()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p record;
  c jsonb;
  v_todo int;
  v_parts text[];
  v_parts_ar text[];
  n int := 0;
begin
  for p in
    select distinct r.professor_id as id
    from public.rooms r
    join public.profiles pr on pr.id = r.professor_id and pr.role = 'professor'
  loop
    c := public.teacher_week_counts(p.id);
    v_todo := (c ->> 'short_answers')::int + (c ->> 'exercise_copies')::int;
    v_parts := '{}';
    v_parts_ar := '{}';
    if v_todo > 0 then
      v_parts := v_parts || (v_todo::text || ' copie(s) ou réponse(s) à corriger');
      v_parts_ar := v_parts_ar || (v_todo::text || ' ورقة أو إجابة للتصحيح');
    end if;
    if (c ->> 'inactive_students')::int > 0 then
      v_parts := v_parts || ((c ->> 'inactive_students') || ' élève(s) sans connexion depuis 7 jours');
      v_parts_ar := v_parts_ar || ((c ->> 'inactive_students') || ' تلميذ بدون اتصال منذ 7 أيام');
    end if;
    if (c ->> 'absences')::int > 0 then
      v_parts := v_parts || ((c ->> 'absences') || ' absence(s) cette semaine');
      v_parts_ar := v_parts_ar || ((c ->> 'absences') || ' غياب هذا الأسبوع');
    end if;

    if cardinality(v_parts) > 0 then
      insert into public.notifications (user_id, title, message, type)
      values (p.id, 'Votre semaine · أسبوعك',
              array_to_string(v_parts, ' · ') || E'\n' || array_to_string(v_parts_ar, ' · '),
              'info');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

revoke all on function public.teacher_weekly_digest() from public, anon, authenticated;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponible : résumé du lundi désactivé (le tableau de bord l''affiche quand même).';
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('resume-lundi-profs');
    exception when others then
      null;
    end;
    -- Lundi 7 h (UTC), soit 7 h ou 8 h au Maroc
    perform cron.schedule('resume-lundi-profs', '0 7 * * 1', 'select public.teacher_weekly_digest();');
  end if;
exception when others then
  raise notice 'Planification du résumé impossible : %', sqlerrm;
end $$;

-- =====================================================================
-- E. Habilitations
-- =====================================================================
do $$
begin
  if to_regclass('public.permissions') is null then
    raise notice 'table permissions absente : habilitations non ajoutées';
    return;
  end if;

  insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
    ('attendance.manage', 'student', 'Faire l''appel (présences)', 'تسجيل الحضور والغياب', 'Take attendance', 'feature', true, 125),
    ('student.groups', 'student', 'Groupes de besoin', 'مجموعات الحاجة', 'Need-based groups', 'feature', true, 135),
    ('student.appreciations', 'reports', 'Appréciations des bulletins', 'ملاحظات النشرات', 'Report card comments', 'feature', true, 375),
    ('reports.parent_report', 'reports', 'Bilan par élève pour les parents', 'حصيلة التلميذ للآباء', 'Student report for parents', 'feature', false, 385)
  on conflict (key) do nothing;

  insert into public.plan_permissions (plan_id, permission_key, limit_value)
  select pp.plan_id, x.k, null
  from public.plan_permissions pp
  join (values ('student.view', 'attendance.manage'),
               ('reports.view', 'student.groups'),
               ('reports.view', 'student.appreciations'),
               ('reports.view', 'reports.parent_report')) as x(src, k) on x.src = pp.permission_key
  where not exists (select 1 from public.plan_permissions y where y.plan_id = pp.plan_id and y.permission_key = x.k);
end $$;

notify pgrst, 'reload schema';

-- ================= 20261030090000_teaching_tools.sql =================
-- =====================================================================
-- Outils d'enseignement (lot 2 des propositions pour les professeurs)
--
--   A. Banque de questions personnelle : question_bank (réutilisable dans tous les quiz,
--      y compris les modèles à paramètres aléatoires).
--   B. Remédiation en un clic : create_remediation_quiz() copie les questions les moins
--      réussies d'un quiz dans un nouveau quiz et prévient les élèves concernés.
--   C. Carnet de notes : gradebook_columns / gradebook_marks (devoirs, contrôles, activités),
--      exportable vers Massar.
--   D. Cahier de textes : lesson_log (séances, contenu, travail à faire), lisible par les élèves.
--   E. Quiz en direct : live_sessions / live_answers + live_state(), live_answer(), live_open().
--   F. Habilitations « quiz.bank », « quiz.remediation », « gradebook.manage »,
--      « lesson_log.manage », « quiz.live » (src/lib/permissions.ts).
--
-- À exécuter à la main dans le SQL Editor de Supabase, APRÈS
-- 20261029090000_class_followup.sql (utilise owns_room). Idempotent.
-- =====================================================================

-- Élève rattaché à une classe (profil ou inscription)
create or replace function public.in_room(p_room_id uuid, p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_uid is not null and (
    exists (select 1 from public.profiles p where p.id = p_uid and p.room_id = p_room_id)
    or exists (select 1 from public.enrollments en where en.student_id = p_uid and en.room_id = p_room_id)
  )
$$;
revoke all on function public.in_room(uuid, uuid) from public, anon;
grant execute on function public.in_room(uuid, uuid) to authenticated;

-- =====================================================================
-- A. Banque de questions
-- =====================================================================
create table if not exists public.question_bank (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question      text not null,
  question_type text not null default 'multiple_choice'
                check (question_type in ('multiple_choice', 'true_false', 'short_answer')),
  points        int not null default 1 check (points between 0 and 100),
  -- [{ "text": "...", "is_correct": true }]
  options       jsonb not null default '[]'::jsonb,
  chapter       text,
  level         text,
  tags          text[] not null default '{}',
  -- Modèle à paramètres : { "params": [{ "name": "a", "min": 1, "max": 9, "step": 1 }], "answer": "a+b", "decimals": 0 }
  template      jsonb,
  times_used    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_question_bank_owner on public.question_bank (owner_id, created_at desc);

alter table public.question_bank enable row level security;
grant select, insert, update, delete on public.question_bank to authenticated;

drop policy if exists "Question bank owner" on public.question_bank;
create policy "Question bank owner" on public.question_bank
  for all to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin(auth.uid()))
  with check (owner_id = (select auth.uid()) and public.is_professor(auth.uid()));

-- =====================================================================
-- B. Remédiation en un clic
--
-- Questions dont le taux de réussite est < p_success_max % (les p_max plus ratées),
-- copiées dans un nouveau quiz du même cours (visible). Les élèves dont la note est
-- < p_score_max % reçoivent une notification. Retour : { exam_id, questions, students }.
-- =====================================================================
create or replace function public.create_remediation_quiz(
  p_exam_id uuid,
  p_score_max numeric default 50,
  p_success_max numeric default 60,
  p_max int default 10,
  p_title text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_exam public.exams;
  v_prof uuid;
  v_new uuid := gen_random_uuid();
  v_q record;
  v_new_q uuid;
  v_order int := 0;
  v_students int := 0;
  v_title text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  select * into v_exam from public.exams where id = p_exam_id;
  if v_exam.id is null then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  select c.professor_id into v_prof from public.courses c where c.id = v_exam.course_id;
  if v_prof is distinct from v_uid and not public.is_admin(v_uid) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if public.is_professor(v_uid) and not public.has_permission('quiz.remediation', v_uid) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_title := coalesce(nullif(btrim(p_title), ''), 'Remédiation · ' || v_exam.title);

  insert into public.exams
  select (jsonb_populate_record(null::public.exams, to_jsonb(v_exam) || jsonb_build_object(
    'id', v_new,
    'title', v_title,
    'is_visible', true,
    'exam_date', now(),
    'available_from', null,
    'available_until', null,
    'description', regexp_replace(coalesce(v_exam.description, ''), '<!--AVAIL_UNTIL:[^>]*-->', '', 'g'),
    'created_at', now(),
    'updated_at', now()))).*;

  for v_q in
    select q.*, coalesce(st.rate, 0) as rate
    from public.quiz_questions q
    join lateral (
      select avg(case when a.is_correct then 100.0 else 0 end) as rate, count(*) as n
      from public.quiz_answers a
      join public.quiz_submissions s on s.id = a.submission_id and s.is_completed is true
      where a.question_id = q.id
    ) st on true
    where q.exam_id = p_exam_id
      and q.question_type <> 'short_answer'
      and st.n > 0
      and st.rate < p_success_max
    order by st.rate asc, q.question_order
    limit greatest(1, least(coalesce(p_max, 10), 50))
  loop
    v_order := v_order + 1;
    v_new_q := gen_random_uuid();
    insert into public.quiz_questions (id, exam_id, question, question_order, question_type, points)
    values (v_new_q, v_new, v_q.question, v_order, v_q.question_type, v_q.points);
    insert into public.quiz_options (id, question_id, option_text, is_correct, option_order)
    select gen_random_uuid(), v_new_q, o.option_text, o.is_correct, o.option_order
    from public.quiz_options o where o.question_id = v_q.id;
  end loop;

  if v_order = 0 then
    raise exception 'NO_WEAK_QUESTIONS' using errcode = 'P0001';
  end if;

  -- Élèves sous le seuil (meilleure tentative)
  insert into public.notifications (user_id, title, message, type, exam_id, course_id)
  select x.student_id,
         'Quiz de remédiation · اختبار للدعم',
         v_title || E'\n' || 'Un quiz de révision vous attend sur les questions les moins réussies. · اختبار للمراجعة في انتظارك.',
         'info', v_new, v_exam.course_id
  from (
    select s.student_id, max(case when coalesce(s.total_points, 0) > 0 then s.score * 100.0 / s.total_points else 0 end) as best
    from public.quiz_submissions s
    where s.exam_id = p_exam_id and s.is_completed is true
    group by s.student_id
  ) x
  where x.best < p_score_max;
  get diagnostics v_students = row_count;

  return jsonb_build_object('exam_id', v_new, 'questions', v_order, 'students', v_students);
end $$;
revoke all on function public.create_remediation_quiz(uuid, numeric, numeric, int, text) from public, anon;
grant execute on function public.create_remediation_quiz(uuid, numeric, numeric, int, text) to authenticated;

-- =====================================================================
-- C. Carnet de notes
-- =====================================================================
create table if not exists public.gradebook_columns (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  term       text not null default 'S1',
  title      text not null,
  -- devoir surveillé, contrôle continu, activités intégrées, autre
  kind       text not null default 'devoir' check (kind in ('devoir', 'controle', 'activite', 'autre')),
  max_points numeric not null default 20 check (max_points > 0),
  coef       numeric not null default 1 check (coef >= 0),
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_gradebook_columns_room on public.gradebook_columns (room_id, term, position);

create table if not exists public.gradebook_marks (
  column_id  uuid not null references public.gradebook_columns(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  value      numeric check (value >= 0),
  absent     boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (column_id, student_id)
);

alter table public.gradebook_columns enable row level security;
alter table public.gradebook_marks enable row level security;
grant select, insert, update, delete on public.gradebook_columns, public.gradebook_marks to authenticated;

drop policy if exists "Gradebook columns by room professor" on public.gradebook_columns;
create policy "Gradebook columns by room professor" on public.gradebook_columns
  for all to authenticated
  using (public.owns_room(room_id))
  with check (public.owns_room(room_id));

drop policy if exists "Gradebook marks by room professor" on public.gradebook_marks;
create policy "Gradebook marks by room professor" on public.gradebook_marks
  for all to authenticated
  using (exists (select 1 from public.gradebook_columns c where c.id = column_id and public.owns_room(c.room_id)))
  with check (exists (select 1 from public.gradebook_columns c where c.id = column_id and public.owns_room(c.room_id)));

-- =====================================================================
-- D. Cahier de textes
-- =====================================================================
create table if not exists public.lesson_log (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  lesson_date date not null default current_date,
  slot        smallint not null default 1 check (slot between 1 and 12),
  course_id   uuid references public.courses(id) on delete set null,
  title       text not null,
  content     text,
  homework    text,
  homework_due date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_lesson_log_room on public.lesson_log (room_id, lesson_date desc);

alter table public.lesson_log enable row level security;
grant select, insert, update, delete on public.lesson_log to authenticated;

drop policy if exists "Lesson log readable" on public.lesson_log;
create policy "Lesson log readable" on public.lesson_log
  for select to authenticated
  using (public.owns_room(room_id) or public.in_room(room_id));

drop policy if exists "Lesson log managed by room professor" on public.lesson_log;
create policy "Lesson log managed by room professor" on public.lesson_log
  for all to authenticated
  using (public.owns_room(room_id))
  with check (public.owns_room(room_id));

-- =====================================================================
-- E. Quiz en direct
-- =====================================================================
create table if not exists public.live_sessions (
  id                  uuid primary key default gen_random_uuid(),
  exam_id             uuid not null references public.exams(id) on delete cascade,
  room_id             uuid not null references public.rooms(id) on delete cascade,
  professor_id        uuid not null default auth.uid(),
  -- lobby → question → reveal → question → … → ended
  state               text not null default 'lobby' check (state in ('lobby', 'question', 'reveal', 'ended')),
  current_index       int not null default -1,
  question_started_at timestamptz,
  created_at          timestamptz not null default now(),
  ended_at            timestamptz
);
create index if not exists idx_live_sessions_room on public.live_sessions (room_id, created_at desc);

create table if not exists public.live_answers (
  session_id  uuid not null references public.live_sessions(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  student_id  uuid not null references auth.users(id) on delete cascade,
  option_id   uuid,
  is_correct  boolean not null default false,
  answer_ms   int,
  answered_at timestamptz not null default now(),
  primary key (session_id, question_id, student_id)
);

alter table public.live_sessions enable row level security;
alter table public.live_answers enable row level security;
grant select, insert, update, delete on public.live_sessions to authenticated;
grant select on public.live_answers to authenticated;

drop policy if exists "Live sessions readable" on public.live_sessions;
create policy "Live sessions readable" on public.live_sessions
  for select to authenticated
  using (public.owns_room(room_id) or public.in_room(room_id));

drop policy if exists "Live sessions managed by room professor" on public.live_sessions;
create policy "Live sessions managed by room professor" on public.live_sessions
  for all to authenticated
  using (public.owns_room(room_id))
  with check (
    public.owns_room(room_id)
    and exists (select 1 from public.exams e join public.courses c on c.id = e.course_id
                where e.id = live_sessions.exam_id and c.room_id = live_sessions.room_id)
  );

-- Les élèves ne voient que leurs réponses ; le professeur voit tout (écriture : live_answer())
drop policy if exists "Live answers readable" on public.live_answers;
create policy "Live answers readable" on public.live_answers
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or exists (select 1 from public.live_sessions s where s.id = session_id and public.owns_room(s.room_id))
  );

-- État courant pour un élève : question en cours et options sans la bonne réponse
-- (sauf en phase « reveal »). Retour null s'il n'y a pas de session ouverte.
create or replace function public.live_state(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.live_sessions;
  v_q public.quiz_questions;
  v_total int;
  v_mine jsonb;
begin
  select * into v_s from public.live_sessions where id = p_session_id;
  if v_s.id is null or not (public.in_room(v_s.room_id, v_uid) or public.owns_room(v_s.room_id)) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  select count(*) into v_total from public.quiz_questions where exam_id = v_s.exam_id;
  if v_s.current_index >= 0 then
    select * into v_q from public.quiz_questions
    where exam_id = v_s.exam_id
    order by question_order, id
    offset v_s.current_index limit 1;
  end if;
  if v_q.id is not null then
    select jsonb_build_object('option_id', a.option_id, 'is_correct', case when v_s.state = 'reveal' then a.is_correct end)
      into v_mine
    from public.live_answers a
    where a.session_id = v_s.id and a.question_id = v_q.id and a.student_id = v_uid;
  end if;

  return jsonb_build_object(
    'id', v_s.id,
    'state', v_s.state,
    'index', v_s.current_index,
    'total', v_total,
    'title', (select e.title from public.exams e where e.id = v_s.exam_id),
    'question', case when v_q.id is null or v_s.state not in ('question', 'reveal') then null else jsonb_build_object(
      'id', v_q.id,
      'text', v_q.question,
      'type', v_q.question_type,
      'options', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', o.id,
                 'text', o.option_text,
                 'correct', case when v_s.state = 'reveal' then o.is_correct end)
               order by o.option_order, o.id)
        from public.quiz_options o where o.question_id = v_q.id), '[]'::jsonb)
    ) end,
    'mine', v_mine,
    'score', (select count(*) filter (where a.is_correct) from public.live_answers a
              where a.session_id = v_s.id and a.student_id = v_uid and (v_s.state <> 'question' or v_q.id is null or a.question_id <> v_q.id))
  );
end $$;
revoke all on function public.live_state(uuid) from public, anon;
grant execute on function public.live_state(uuid) to authenticated;

-- Réponse d'un élève à la question en cours (une seule, non modifiable)
create or replace function public.live_answer(p_session_id uuid, p_question_id uuid, p_option_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.live_sessions;
  v_current uuid;
  v_ok boolean;
begin
  select * into v_s from public.live_sessions where id = p_session_id;
  if v_s.id is null or not public.in_room(v_s.room_id, v_uid) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if v_s.state <> 'question' then
    raise exception 'QUESTION_CLOSED' using errcode = 'P0001';
  end if;
  select id into v_current from public.quiz_questions
  where exam_id = v_s.exam_id order by question_order, id offset v_s.current_index limit 1;
  if v_current is distinct from p_question_id then
    raise exception 'QUESTION_CLOSED' using errcode = 'P0001';
  end if;
  select coalesce(o.is_correct, false) into v_ok
  from public.quiz_options o where o.id = p_option_id and o.question_id = p_question_id;
  if v_ok is null then
    raise exception 'INVALID_OPTION' using errcode = '22023';
  end if;
  insert into public.live_answers (session_id, question_id, student_id, option_id, is_correct, answer_ms)
  values (p_session_id, p_question_id, v_uid, p_option_id, v_ok,
          (extract(epoch from (now() - coalesce(v_s.question_started_at, now()))) * 1000)::int)
  on conflict (session_id, question_id, student_id) do nothing;
  return true;
end $$;
revoke all on function public.live_answer(uuid, uuid, uuid) from public, anon;
grant execute on function public.live_answer(uuid, uuid, uuid) to authenticated;

-- Sessions ouvertes des classes de l'élève (bandeau « Quiz en direct »)
create or replace function public.live_open()
returns table (id uuid, room_id uuid, title text, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.room_id, e.title, s.state
  from public.live_sessions s
  join public.exams e on e.id = s.exam_id
  where s.state <> 'ended'
    and s.created_at > now() - interval '6 hours'
    and public.in_room(s.room_id, auth.uid())
  order by s.created_at desc
$$;
revoke all on function public.live_open() from public, anon;
grant execute on function public.live_open() to authenticated;

-- Temps réel
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.live_sessions;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.live_answers;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- =====================================================================
-- Règles « hab: » (RESTRICTIVES)
-- =====================================================================
do $$
declare
  spec record;
begin
  if to_regprocedure('public.is_professor(uuid)') is null
     or to_regprocedure('public.has_permission(text, uuid)') is null then
    raise notice 'fonctions is_professor / has_permission absentes : règles « hab: » non créées';
    return;
  end if;
  for spec in
    select * from (values
      ('question_bank', 'quiz.bank'),
      ('gradebook_columns', 'gradebook.manage'),
      ('gradebook_marks', 'gradebook.manage'),
      ('lesson_log', 'lesson_log.manage'),
      ('live_sessions', 'quiz.live')
    ) as t(tbl, perm)
  loop
    execute format('drop policy if exists %I on public.%I', 'hab: ecrire ' || spec.tbl || ' (insert)', spec.tbl);
    execute format('drop policy if exists %I on public.%I', 'hab: ecrire ' || spec.tbl || ' (update)', spec.tbl);
    execute format('drop policy if exists %I on public.%I', 'hab: ecrire ' || spec.tbl || ' (delete)', spec.tbl);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (not (select public.is_professor()) or (select public.has_permission(%L)))',
                   'hab: ecrire ' || spec.tbl || ' (insert)', spec.tbl, spec.perm);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (not (select public.is_professor()) or (select public.has_permission(%L)))',
                   'hab: ecrire ' || spec.tbl || ' (update)', spec.tbl, spec.perm);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (not (select public.is_professor()) or (select public.has_permission(%L)))',
                   'hab: ecrire ' || spec.tbl || ' (delete)', spec.tbl, spec.perm);
  end loop;
end $$;

-- =====================================================================
-- F. Habilitations
-- =====================================================================
do $$
begin
  if to_regclass('public.permissions') is null then
    raise notice 'table permissions absente : habilitations non ajoutées';
    return;
  end if;

  insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
    ('quiz.bank', 'quiz', 'Banque de questions', 'بنك الأسئلة', 'Question bank', 'feature', true, 280),
    ('quiz.remediation', 'quiz', 'Quiz de remédiation en un clic', 'اختبار الدعم بنقرة واحدة', 'One-click remediation quiz', 'feature', true, 285),
    ('quiz.live', 'quiz', 'Quiz en direct en classe', 'اختبار مباشر في القسم', 'Live in-class quiz', 'feature', true, 290),
    ('gradebook.manage', 'reports', 'Carnet de notes et export Massar', 'دفتر النقط والتصدير إلى مسار', 'Gradebook and Massar export', 'feature', true, 365),
    ('lesson_log.manage', 'course', 'Cahier de textes', 'دفتر النصوص', 'Lesson log', 'feature', true, 160)
  on conflict (key) do nothing;

  insert into public.plan_permissions (plan_id, permission_key, limit_value)
  select pp.plan_id, x.k, null
  from public.plan_permissions pp
  join (values ('quiz.edit', 'quiz.bank'),
               ('quiz.edit', 'quiz.remediation'),
               ('quiz.edit', 'quiz.live'),
               ('reports.view', 'gradebook.manage'),
               ('student.view', 'lesson_log.manage')) as x(src, k) on x.src = pp.permission_key
  where not exists (select 1 from public.plan_permissions y where y.plan_id = pp.plan_id and y.permission_key = x.k);
end $$;

notify pgrst, 'reload schema';

-- ================= 20261031090000_teacher_ai.sql =================
-- =====================================================================
-- Outils IA pour les professeurs (lot 3 des propositions)
--
--   A. ai_usage : journal des générations (limite quotidienne dans la fonction teacher-ai).
--   B. lesson_plans : fiches pédagogiques enregistrées par le professeur.
--   C. record_paper_submission() : copie papier d'un QCM (lue sur photo par l'IA, vérifiée
--      par le professeur) enregistrée et corrigée comme une copie en ligne.
--   D. Habilitations « ai.quiz_generator », « ai.lesson_plan » et « ai.omr » (src/lib/permissions.ts).
--
-- La fonction Edge supabase/functions/teacher-ai doit être déployée et le secret
-- ANTHROPIC_API_KEY défini (déjà utilisé par translate-text).
-- À exécuter à la main dans le SQL Editor de Supabase, APRÈS 20261030090000_teaching_tools.sql
-- (utilise in_room). Idempotent.
-- =====================================================================

-- A. Journal d'utilisation (écrit par la fonction avec la clé service)
create table if not exists public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null,
  input_tokens  int,
  output_tokens int,
  created_at    timestamptz not null default now()
);
create index if not exists idx_ai_usage_user on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;
grant select on public.ai_usage to authenticated;
drop policy if exists "AI usage readable by owner" on public.ai_usage;
create policy "AI usage readable by owner" on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin(auth.uid()));

-- B. Fiches pédagogiques
create table if not exists public.lesson_plans (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null,
  level      text,
  language   text not null default 'fr',
  content    jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lesson_plans_owner on public.lesson_plans (owner_id, created_at desc);
alter table public.lesson_plans enable row level security;
grant select, insert, update, delete on public.lesson_plans to authenticated;
drop policy if exists "Lesson plans owner" on public.lesson_plans;
create policy "Lesson plans owner" on public.lesson_plans
  for all to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin(auth.uid()))
  with check (owner_id = (select auth.uid()) and public.is_professor(auth.uid()));

-- C. Copies papier
-- p_answers : [{ "question_id": uuid, "selected_option_ids": [uuid, …] }]
-- Les réponses rédigées restent vides (à corriger à part). Une nouvelle lecture du même
-- élève remplace sa copie papier précédente (repérée par anti_cheat_log = [{"type":"paper"}]).
create or replace function public.record_paper_submission(p_exam_id uuid, p_student_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room uuid;
  v_prof uuid;
  q record;
  v_ans jsonb;
  v_sel uuid[];
  v_correct uuid[];
  v_points int;
  v_ok boolean;
  v_score numeric := 0;
  v_total int := 0;
  v_sub uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  select c.room_id, c.professor_id into v_room, v_prof
  from public.exams e join public.courses c on c.id = e.course_id
  where e.id = p_exam_id;
  if v_prof is null or (v_prof <> v_uid and not public.is_admin(v_uid)) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if public.is_professor(v_uid) and not public.has_permission('ai.omr', v_uid) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not public.in_room(v_room, p_student_id) then
    raise exception 'STUDENT_NOT_IN_CLASS' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_ANSWERS' using errcode = '22023';
  end if;

  delete from public.quiz_submissions s
  where s.exam_id = p_exam_id and s.student_id = p_student_id
    and s.anti_cheat_log @> '[{"type": "paper"}]'::jsonb;

  insert into public.quiz_submissions (exam_id, student_id, score, total_points, is_completed, submitted_at, time_taken_minutes, anti_cheat_events, anti_cheat_log)
  values (p_exam_id, p_student_id, 0, 0, true, now(), null, 0, '[{"type": "paper"}]'::jsonb)
  returning id into v_sub;

  for q in
    select qq.id, qq.question_type, qq.points from public.quiz_questions qq
    where qq.exam_id = p_exam_id order by qq.question_order nulls last, qq.id
  loop
    v_points := coalesce(nullif(q.points, 0), 1);
    v_total := v_total + v_points;
    if q.question_type = 'short_answer' then
      insert into public.quiz_answers (submission_id, question_id, is_correct, points_earned) values (v_sub, q.id, false, 0);
      continue;
    end if;
    select a.value into v_ans from jsonb_array_elements(p_answers) a
    where jsonb_typeof(a.value) = 'object' and a.value ->> 'question_id' = q.id::text limit 1;
    select coalesce(array_agg(o.id order by o.option_order), '{}') into v_sel
    from public.quiz_options o
    where o.question_id = q.id
      and o.id::text in (select jsonb_array_elements_text(case when jsonb_typeof(v_ans -> 'selected_option_ids') = 'array' then v_ans -> 'selected_option_ids' else '[]'::jsonb end));
    select coalesce(array_agg(o.id), '{}') into v_correct from public.quiz_options o where o.question_id = q.id and o.is_correct is true;
    v_ok := cardinality(v_correct) > 0 and cardinality(v_sel) = cardinality(v_correct) and v_correct <@ v_sel;
    if v_ok then v_score := v_score + v_points; end if;
    insert into public.quiz_answers (submission_id, question_id, selected_option_id, is_correct, points_earned)
    values (v_sub, q.id, v_sel[1], v_ok, case when v_ok then v_points else 0 end);
  end loop;

  update public.quiz_submissions set score = v_score, total_points = v_total where id = v_sub;
  return jsonb_build_object('submission_id', v_sub, 'score', v_score, 'total_points', v_total);
end $$;
revoke all on function public.record_paper_submission(uuid, uuid, jsonb) from public, anon;
grant execute on function public.record_paper_submission(uuid, uuid, jsonb) to authenticated;

-- D. Habilitations
do $$
begin
  if to_regclass('public.permissions') is null then
    raise notice 'table permissions absente : habilitations non ajoutées';
    return;
  end if;

  insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
    ('ai.quiz_generator', 'quiz', 'Générer un quiz avec l''IA à partir d''un cours', 'توليد اختبار بالذكاء الاصطناعي من درس', 'Generate a quiz from a course with AI', 'feature', true, 295),
    ('ai.lesson_plan', 'course', 'Fiche pédagogique avec l''IA', 'جذاذة بالذكاء الاصطناعي', 'AI lesson plan', 'feature', true, 165),
    ('ai.omr', 'quiz', 'Corriger des QCM papier par photo', 'تصحيح أوراق الاختيار من متعدد بالصور', 'Grade paper multiple-choice sheets from photos', 'feature', true, 296)
  on conflict (key) do nothing;

  insert into public.plan_permissions (plan_id, permission_key, limit_value)
  select pp.plan_id, x.k, null
  from public.plan_permissions pp
  join (values ('quiz.edit', 'ai.quiz_generator'),
               ('course.edit', 'ai.lesson_plan'),
               ('quiz.results_view', 'ai.omr')) as x(src, k) on x.src = pp.permission_key
  where not exists (select 1 from public.plan_permissions y where y.plan_id = pp.plan_id and y.permission_key = x.k);
end $$;

notify pgrst, 'reload schema';

