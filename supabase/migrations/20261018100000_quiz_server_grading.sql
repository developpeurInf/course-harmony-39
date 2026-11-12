-- =====================================================================
-- Quiz : correction côté serveur (sécurité)
--
-- Avant : la note était calculée dans le navigateur. Un élève pouvait lire
-- quiz_options.is_correct (règle « viewable by everyone ») et insérer /
-- modifier lui-même ses copies (quiz_submissions / quiz_answers).
--
-- Après :
--   * les élèves lisent les options via quiz_options_for_student() (sans is_correct) ;
--   * l'envoi passe par submit_quiz_attempt() qui corrige côté serveur et
--     écrit copie + réponses dans une seule transaction ;
--   * le corrigé d'une copie passe par quiz_review_for_student() ;
--   * plus aucune écriture directe des élèves sur quiz_submissions / quiz_answers ;
--   * les clés étrangères en double sont supprimées (sélections imbriquées PostgREST).
--
-- Idempotent : peut être exécuté plusieurs fois.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Clés étrangères en double (on garde les *_fkey et fk_quiz_answers_option)
--    Une contrainte « fk_… » n'est supprimée que si une autre clé étrangère
--    identique (mêmes colonnes, même table cible) existe : on ne retire
--    jamais la seule contrainte d'une colonne.
-- ---------------------------------------------------------------------
do $$
declare
  spec record;
  dup record;
begin
  for spec in
    select * from (values
      ('quiz_options',     'fk_quiz_options_question'),
      ('quiz_submissions', 'fk_quiz_submissions_exam'),
      ('quiz_answers',     'fk_quiz_answers_question'),
      ('quiz_answers',     'fk_quiz_answers_submission')
    ) as t(tbl, con)
  loop
    if to_regclass('public.' || spec.tbl) is null then
      continue;
    end if;
    select c.oid, c.conrelid, c.conkey, c.confrelid into dup
    from pg_constraint c
    where c.conrelid = to_regclass('public.' || spec.tbl)
      and c.conname = spec.con
      and c.contype = 'f';
    if dup.oid is null then
      continue;
    end if;
    if exists (
      select 1 from pg_constraint o
      where o.conrelid = dup.conrelid
        and o.contype = 'f'
        and o.oid <> dup.oid
        and o.conkey = dup.conkey
        and o.confrelid = dup.confrelid
    ) then
      execute format('alter table public.%I drop constraint if exists %I', spec.tbl, spec.con);
    else
      raise notice 'contrainte % conservée : aucune autre clé étrangère équivalente sur public.%', spec.con, spec.tbl;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Fonctions utilitaires (internes)
-- ---------------------------------------------------------------------

-- Paramètres du quiz stockés dans exams.description :
--   <!--QUIZ_SETTINGS:{...}-->   (voir serializeExamDescription / parseExamAvailability)
-- Valeurs par défaut identiques à DEFAULT_QUIZ_SETTINGS (CourseContext.tsx).
create or replace function public.quiz_settings_from_description(p_description text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_settings jsonb := '{"allowMultipleAttempts": false, "showResultsImmediately": true, "allowReview": true}'::jsonb;
  v_raw text;
  v_parsed jsonb;
begin
  v_raw := substring(coalesce(p_description, '') from '<!--QUIZ_SETTINGS:(.+?)-->');
  if v_raw is not null then
    begin
      v_parsed := btrim(v_raw)::jsonb;
      if jsonb_typeof(v_parsed) = 'object' then
        v_settings := v_settings || v_parsed;
      end if;
    exception when others then
      null; -- JSON invalide : valeurs par défaut (comme le client)
    end;
  end if;
  return v_settings;
end $$;

-- Valeur « vraie » au sens JavaScript d'un paramètre (null si absent)
create or replace function public.quiz_setting_flag(p_settings jsonb, p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case jsonb_typeof(p_settings -> p_key)
    when 'boolean' then (p_settings ->> p_key)::boolean
    when 'null'    then false
    when 'number'  then (p_settings ->> p_key)::numeric <> 0
    when 'string'  then (p_settings ->> p_key) <> ''
    when 'object'  then true
    when 'array'   then true
    else null
  end
$$;

-- Fin de disponibilité : <!--AVAIL_UNTIL:2026-10-18T10:00:00.000Z-->
create or replace function public.quiz_available_until(p_description text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_raw text;
begin
  v_raw := substring(coalesce(p_description, '') from '<!--AVAIL_UNTIL:([^\n]+?)-->');
  if v_raw is null or btrim(v_raw) = '' then
    return null;
  end if;
  begin
    return btrim(v_raw)::timestamptz;
  exception when others then
    return null;
  end;
end $$;

-- Accès élève à un quiz : même règle que getVisibleExamsForStudent (CourseContext.tsx)
--   examen visible, cours non masqué, et élève de la classe du cours
--   (profiles.room_id = courses.room_id) OU inscrit au cours (enrollments).
create or replace function public.quiz_student_can_access(p_exam_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_uid is not null
    and not public.is_professor(p_uid)
    and exists (
      select 1
      from public.exams e
      join public.courses c on c.id = e.course_id
      where e.id = p_exam_id
        and e.is_visible is true
        and c.is_visible is not false
        and (
          exists (
            select 1 from public.profiles p
            where p.id = p_uid and p.room_id is not null and p.room_id = c.room_id
          )
          or exists (
            select 1 from public.enrollments en
            where en.student_id = p_uid and en.course_id = c.id
          )
        )
    )
$$;

-- ---------------------------------------------------------------------
-- 3. Lecture des options par un élève (sans is_correct)
--    is_multi : QCM à plusieurs bonnes réponses (le client affichait déjà
--    « Plusieurs réponses possibles » et passe en sélection multiple).
-- ---------------------------------------------------------------------
drop function if exists public.quiz_options_for_student(uuid);
create function public.quiz_options_for_student(p_exam_id uuid)
returns table (id uuid, question_id uuid, option_text text, option_order integer, is_multi boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_exam_date timestamptz;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if not public.quiz_student_can_access(p_exam_id, v_uid) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  -- Avant l'ouverture (5 min de tolérance d'horloge), seulement si l'élève a déjà une copie
  select e.exam_date into v_exam_date from public.exams e where e.id = p_exam_id;
  if v_exam_date is not null
     and now() < v_exam_date - interval '5 minutes'
     and not exists (
       select 1 from public.quiz_submissions s
       where s.exam_id = p_exam_id and s.student_id = v_uid
     ) then
    raise exception 'QUIZ_NOT_OPEN' using errcode = '42501';
  end if;

  return query
    select o.id,
           o.question_id,
           o.option_text,
           o.option_order,
           (q.question_type = 'multiple_choice'
             and (select count(*) from public.quiz_options o2
                  where o2.question_id = q.id and o2.is_correct is true) > 1) as is_multi
    from public.quiz_options o
    join public.quiz_questions q on q.id = o.question_id
    where q.exam_id = p_exam_id
    order by q.question_order nulls last, o.option_order nulls last, o.id;
end $$;

-- ---------------------------------------------------------------------
-- 4. Envoi d'une tentative : correction côté serveur
--
-- p_answers : [{ "question_id": uuid, "selected_option_ids": [uuid, …], "text_answer": text }]
-- Règles (identiques à l'ancienne correction de QuizTaker.tsx) :
--   * points = quiz_questions.points, ou 1 si null / 0 ;
--   * réponse libre (short_answer) : 0 point, à corriger par l'enseignant (gradable = false) ;
--   * QCM / vrai-faux : correct si l'ensemble des options choisies est EXACTEMENT
--     l'ensemble des bonnes réponses (pas de crédit partiel) ;
--   * question sans bonne réponse configurée : non notée (gradable = false, 0 point) ;
--   * QCM multi-réponses : text_answer = textes des options choisies joints par « ; » ;
--   * selected_option_id = première option choisie.
-- ---------------------------------------------------------------------
create or replace function public.submit_quiz_attempt(
  p_exam_id uuid,
  p_answers jsonb,
  p_time_taken_minutes integer default null,
  p_anti_cheat_events integer default 0,
  p_anti_cheat_log jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_exam record;
  v_settings jsonb;
  v_until timestamptz;
  v_duration integer;
  v_answers jsonb;
  q record;
  v_ans jsonb;
  v_sel uuid[];
  v_correct uuid[];
  v_correct_all uuid[] := '{}';
  v_points integer;
  v_ok boolean;
  v_gradable boolean;
  v_earned numeric;
  v_text text;
  v_score numeric := 0;
  v_total integer := 0;
  v_count integer := 0;
  v_results jsonb := '[]'::jsonb;
  a_qid uuid[] := '{}';
  a_opt uuid[] := '{}';
  a_text text[] := '{}';
  a_ok boolean[] := '{}';
  a_pts numeric[] := '{}';
  v_log jsonb;
  v_events integer;
  v_minutes integer;
  v_sub_id uuid;
  v_show boolean;
  v_review boolean;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_answers is not null and jsonb_typeof(p_answers) <> 'array' then
    raise exception 'INVALID_ANSWERS' using errcode = '22023';
  end if;
  v_answers := coalesce(p_answers, '[]'::jsonb);

  if not public.quiz_student_can_access(p_exam_id, v_uid) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  select e.id, e.type::text as type, e.description, e.exam_date, e.duration_minutes
    into v_exam
  from public.exams e
  where e.id = p_exam_id;
  if coalesce(v_exam.type, 'quiz') <> 'quiz' then
    raise exception 'NOT_A_QUIZ' using errcode = '22023';
  end if;

  -- Fenêtre d'ouverture : exam_date → AVAIL_UNTIL (+ durée du quiz + 15 min pour
  -- un envoi en fin de temps ou un nouvel essai après une coupure réseau)
  v_settings := public.quiz_settings_from_description(v_exam.description);
  v_until := public.quiz_available_until(v_exam.description);
  v_duration := coalesce(nullif(v_exam.duration_minutes, 0), 30);
  if v_exam.exam_date is not null and now() < v_exam.exam_date - interval '5 minutes' then
    raise exception 'QUIZ_NOT_OPEN' using errcode = '42501';
  end if;
  if v_until is not null and now() > v_until + make_interval(mins => v_duration) + interval '15 minutes' then
    raise exception 'QUIZ_CLOSED' using errcode = '42501';
  end if;

  -- Deux envois simultanés du même élève pour le même quiz : l'un attend l'autre
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_exam_id::text, 0));

  if not coalesce(public.quiz_setting_flag(v_settings, 'allowMultipleAttempts'), false)
     and exists (
       select 1 from public.quiz_submissions s
       where s.exam_id = p_exam_id and s.student_id = v_uid and s.is_completed is true
     ) then
    raise exception 'ALREADY_SUBMITTED' using errcode = 'P0001';
  end if;

  for q in
    select qq.id, qq.question_type, qq.points
    from public.quiz_questions qq
    where qq.exam_id = p_exam_id
    order by qq.question_order nulls last, qq.id
  loop
    v_count := v_count + 1;
    v_points := coalesce(nullif(q.points, 0), 1);
    v_total := v_total + v_points;

    select a.value into v_ans
    from jsonb_array_elements(v_answers) a
    where jsonb_typeof(a.value) = 'object' and a.value ->> 'question_id' = q.id::text
    limit 1;

    if q.question_type = 'short_answer' then
      v_text := nullif(regexp_replace(coalesce(v_ans ->> 'text_answer', ''), '^\s+|\s+$', '', 'g'), '');
      v_text := left(v_text, 20000);
      a_qid := a_qid || q.id;
      a_opt := a_opt || null::uuid;
      a_text := a_text || v_text;
      a_ok := a_ok || false;
      a_pts := a_pts || 0::numeric;
      v_results := v_results || jsonb_build_object(
        'question_id', q.id, 'is_correct', false, 'points_earned', 0, 'gradable', false);
      continue;
    end if;

    -- Options choisies : uniquement des options de CETTE question, sans doublon,
    -- dans l'ordre d'envoi
    select coalesce(array_agg(x.oid order by x.ord), '{}') into v_sel
    from (
      select distinct on (o.id) o.id as oid, t.ord
      from jsonb_array_elements_text(
             case when jsonb_typeof(v_ans -> 'selected_option_ids') = 'array'
                  then v_ans -> 'selected_option_ids' else '[]'::jsonb end
           ) with ordinality as t(val, ord)
      join public.quiz_options o on o.question_id = q.id and o.id::text = lower(btrim(t.val))
      order by o.id, t.ord
    ) x;

    select coalesce(array_agg(o.id), '{}') into v_correct
    from public.quiz_options o
    where o.question_id = q.id and o.is_correct is true;

    v_text := null;
    if q.question_type = 'multiple_choice' and cardinality(v_correct) > 1 and cardinality(v_sel) > 0 then
      select string_agg(o.option_text, ' ; ' order by o.option_order nulls last, o.id) into v_text
      from public.quiz_options o
      where o.id = any (v_sel);
    end if;

    if cardinality(v_correct) = 0 then
      v_gradable := false;
      v_ok := false;
      v_earned := 0;
    else
      v_gradable := true;
      v_ok := cardinality(v_sel) = cardinality(v_correct) and v_correct <@ v_sel;
      v_earned := case when v_ok then v_points else 0 end;
    end if;
    v_correct_all := v_correct_all || v_correct;
    v_score := v_score + v_earned;

    a_qid := a_qid || q.id;
    a_opt := a_opt || v_sel[1];
    a_text := a_text || v_text;
    a_ok := a_ok || v_ok;
    a_pts := a_pts || v_earned;
    v_results := v_results || jsonb_build_object(
      'question_id', q.id, 'is_correct', v_ok, 'points_earned', v_earned, 'gradable', v_gradable);
  end loop;

  if v_count = 0 then
    raise exception 'NO_QUESTIONS' using errcode = '22023';
  end if;

  -- Journal anti-triche (fourni par le client, borné)
  v_log := case when jsonb_typeof(p_anti_cheat_log) = 'array' then p_anti_cheat_log else null end;
  if v_log is not null and jsonb_array_length(v_log) > 300 then
    select jsonb_agg(t.e order by t.i) into v_log
    from jsonb_array_elements(v_log) with ordinality as t(e, i)
    where t.i <= 300;
  end if;
  if v_log is not null and length(v_log::text) > 200000 then
    v_log := jsonb_build_array(jsonb_build_object('type', 'log_truncated', 'at', now()));
  end if;
  if v_log is not null and jsonb_array_length(v_log) = 0 then
    v_log := null;
  end if;
  v_events := greatest(coalesce(p_anti_cheat_events, 0), coalesce(jsonb_array_length(v_log), 0), 0);
  v_minutes := greatest(1, least(coalesce(p_time_taken_minutes, 1), 100000));

  insert into public.quiz_submissions
    (exam_id, student_id, score, total_points, is_completed, submitted_at,
     time_taken_minutes, anti_cheat_events, anti_cheat_log)
  values
    (p_exam_id, v_uid, v_score, v_total, true, now(),
     v_minutes, v_events, v_log)
  returning id into v_sub_id;

  insert into public.quiz_answers
    (submission_id, question_id, selected_option_id, text_answer, is_correct, points_earned)
  select v_sub_id, u.qid, u.opt, u.txt, u.ok, u.pts
  from unnest(a_qid, a_opt, a_text, a_ok, a_pts) as u(qid, opt, txt, ok, pts);

  v_show := coalesce(public.quiz_setting_flag(v_settings, 'showResultsImmediately'), true);
  v_review := coalesce(public.quiz_setting_flag(v_settings, 'allowReview'), true);

  return jsonb_build_object(
    'submission_id', v_sub_id,
    'score', v_score,
    'total_points', v_total,
    'submitted_at', now(),
    'results', case when v_show then v_results else '[]'::jsonb end,
    'correct_option_ids', case when v_show and v_review then to_jsonb(v_correct_all) else '[]'::jsonb end
  );
end $$;

-- ---------------------------------------------------------------------
-- 5. Corrigé d'une copie déjà envoyée (bouton « Voir le corrigé »)
-- ---------------------------------------------------------------------
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
               'points_earned', a.points_earned))
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

-- ---------------------------------------------------------------------
-- 6. Droits d'exécution
-- ---------------------------------------------------------------------
revoke all on function public.quiz_student_can_access(uuid, uuid) from public, anon, authenticated;
revoke all on function public.quiz_settings_from_description(text) from public, anon;
revoke all on function public.quiz_setting_flag(jsonb, text) from public, anon;
revoke all on function public.quiz_available_until(text) from public, anon;

revoke all on function public.quiz_options_for_student(uuid) from public, anon;
revoke all on function public.submit_quiz_attempt(uuid, jsonb, integer, integer, jsonb) from public, anon;
revoke all on function public.quiz_review_for_student(uuid) from public, anon;
grant execute on function public.quiz_options_for_student(uuid) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid, jsonb, integer, integer, jsonb) to authenticated;
grant execute on function public.quiz_review_for_student(uuid) to authenticated;


-- Les règles d'accès (lecture des options, écritures élèves) sont verrouillées
-- par 20261018100300_quiz_lock_student_writes.sql, après mise en ligne du front.
notify pgrst, 'reload schema';
