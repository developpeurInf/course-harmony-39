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
