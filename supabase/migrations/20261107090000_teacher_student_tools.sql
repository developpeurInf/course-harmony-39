-- =====================================================================
-- Outils professeur, espace élève, parents, support et bibliothèque
-- (à lancer après 20261106090000_admin_tools.sql)
--
--   A. Préférences par utilisateur (seuils d'alerte, notifications) + notes privées
--   B. Classes : archivage et duplication pour l'année suivante
--   C. Cours : ordre et publication programmée ; cahier de textes lié
--   D. Banque de questions : source ; quiz en direct : anonymat, relance
--   E. « À faire aujourd'hui » du professeur
--   F. Élève : progression, chapitres lus, rappels de la veille
--   G. Portail parents (lien en lecture seule) et messages des parents
--   H. Support (tickets) et bibliothèque partagée
--   I. Nouvelles habilitations et journal des migrations appliquées
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. Préférences et notes privées
-- ---------------------------------------------------------------------
create table if not exists public.user_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_prefs enable row level security;
grant select, insert, update on public.user_prefs to authenticated;
drop policy if exists "Prefs perso" on public.user_prefs;
create policy "Prefs perso" on public.user_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.student_notes (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  author_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists idx_student_notes_student on public.student_notes (student_id, created_at desc);
alter table public.student_notes enable row level security;
grant select, insert, update, delete on public.student_notes to authenticated;
drop policy if exists "Notes privées du professeur" on public.student_notes;
create policy "Notes privées du professeur" on public.student_notes for all to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = student_id and public.owns_room(p.room_id))
  );

-- ---------------------------------------------------------------------
-- B. Archivage et duplication de classe
-- ---------------------------------------------------------------------
alter table public.rooms add column if not exists archived_at timestamptz;

create or replace function public.duplicate_room(p_room uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_room uuid;
  c record; e record; x record; q record;
  v_course uuid; v_exam uuid; v_q uuid;
begin
  if not public.owns_room(p_room) then raise exception 'Accès refusé'; end if;
  if not (public.has_permission('class.create') and public.has_permission('class.duplicate')) then
    raise exception 'Fonction non incluse dans votre offre';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Nom obligatoire'; end if;

  insert into public.rooms (name, description, professor_id, is_visible)
  select trim(p_name), r.description, r.professor_id, true from public.rooms r where r.id = p_room
  returning id into v_room;

  for c in select * from public.courses where room_id = p_room loop
    v_course := gen_random_uuid();
    insert into public.courses
    select (jsonb_populate_record(null::public.courses, to_jsonb(c) || jsonb_build_object(
      'id', v_course, 'room_id', v_room, 'is_visible', false, 'publish_at', null,
      'created_at', now(), 'updated_at', now()))).*;

    insert into public.course_materials
    select (jsonb_populate_record(null::public.course_materials, to_jsonb(m) || jsonb_build_object(
      'id', gen_random_uuid(), 'course_id', v_course, 'created_at', now()))).*
    from public.course_materials m where m.course_id = c.id;

    for e in select * from public.exercises where course_id = c.id loop
      insert into public.exercises
      select (jsonb_populate_record(null::public.exercises, to_jsonb(e) || jsonb_build_object(
        'id', gen_random_uuid(), 'course_id', v_course, 'is_visible', false, 'due_date', null,
        'publish_at', null, 'created_at', now(), 'updated_at', now()))).*;
    end loop;

    for x in select * from public.exams where course_id = c.id loop
      v_exam := gen_random_uuid();
      insert into public.exams
      select (jsonb_populate_record(null::public.exams, to_jsonb(x) || jsonb_build_object(
        'id', v_exam, 'course_id', v_course, 'is_visible', false, 'exam_date', null,
        'available_from', null, 'available_until', null, 'created_at', now(), 'updated_at', now()))).*;
      for q in select * from public.quiz_questions where exam_id = x.id loop
        v_q := gen_random_uuid();
        insert into public.quiz_questions
        select (jsonb_populate_record(null::public.quiz_questions, to_jsonb(q) || jsonb_build_object(
          'id', v_q, 'exam_id', v_exam, 'created_at', now(), 'updated_at', now()))).*;
        insert into public.quiz_options
        select (jsonb_populate_record(null::public.quiz_options, to_jsonb(o) || jsonb_build_object(
          'id', gen_random_uuid(), 'question_id', v_q, 'created_at', now()))).*
        from public.quiz_options o where o.question_id = q.id;
      end loop;
    end loop;
  end loop;

  insert into public.gradebook_columns (room_id, term, title, kind, max_points, coef, position)
  select v_room, g.term, g.title, g.kind, g.max_points, g.coef, g.position
  from public.gradebook_columns g where g.room_id = p_room;

  return v_room;
end;
$$;
revoke execute on function public.duplicate_room(uuid, text) from public, anon;
grant execute on function public.duplicate_room(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- C. Cours : ordre, publication programmée ; cahier de textes lié
-- ---------------------------------------------------------------------
alter table public.courses add column if not exists position int;
alter table public.courses add column if not exists publish_at timestamptz;
alter table public.exercises add column if not exists publish_at timestamptz;
alter table public.lesson_log add column if not exists exercise_id uuid references public.exercises(id) on delete set null;
alter table public.lesson_log add column if not exists lesson_plan_id uuid references public.lesson_plans(id) on delete set null;

-- Publie ce qui est programmé (appelée par pg_cron, et à l'ouverture de l'application)
create or replace function public.publish_scheduled_content()
returns integer language plpgsql security definer set search_path = '' as $$
declare n int; m int;
begin
  update public.courses set is_visible = true, publish_at = null, updated_at = now()
  where publish_at is not null and publish_at <= now();
  get diagnostics n = row_count;
  update public.exercises set is_visible = true, publish_at = null, updated_at = now()
  where publish_at is not null and publish_at <= now();
  get diagnostics m = row_count;
  return n + m;
end;
$$;
revoke execute on function public.publish_scheduled_content() from public, anon;
grant execute on function public.publish_scheduled_content() to authenticated;

-- Réordonner les cours d'une classe
create or replace function public.reorder_courses(p_room uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_room(p_room) then raise exception 'Accès refusé'; end if;
  update public.courses c set position = x.ord
  from unnest(p_ids) with ordinality as x(id, ord)
  where c.id = x.id and c.room_id = p_room;
end;
$$;
revoke execute on function public.reorder_courses(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_courses(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- D. Banque de questions (source) et quiz en direct
-- ---------------------------------------------------------------------
alter table public.question_bank add column if not exists source text not null default 'manual';
alter table public.question_bank add column if not exists source_course_id uuid references public.courses(id) on delete set null;
alter table public.question_bank add column if not exists last_used_at timestamptz;

alter table public.live_sessions add column if not exists anonymous boolean not null default false;

-- Relancer une question : on efface les réponses de cette question et on la rouvre
create or replace function public.live_restart_question(p_session uuid, p_index int)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.live_sessions;
begin
  select * into s from public.live_sessions where id = p_session;
  if s.id is null or not (s.professor_id = auth.uid() or public.is_admin(auth.uid())) then raise exception 'Accès refusé'; end if;
  delete from public.live_answers a
  using public.quiz_questions q
  where a.session_id = p_session and q.id = a.question_id and q.exam_id = s.exam_id
    and q.id = (select q2.id from public.quiz_questions q2 where q2.exam_id = s.exam_id
                order by q2.question_order, q2.created_at offset p_index limit 1);
  update public.live_sessions set state = 'question', current_index = p_index, question_started_at = now(), ended_at = null
  where id = p_session;
end;
$$;
revoke execute on function public.live_restart_question(uuid, int) from public, anon;
grant execute on function public.live_restart_question(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- E. « À faire aujourd'hui »
-- ---------------------------------------------------------------------
create or replace function public.teacher_today()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  prefs jsonb := coalesce((select data -> 'alerts' from public.user_prefs where user_id = auth.uid()), '{}'::jsonb);
  v_days int := greatest(1, coalesce((prefs ->> 'inactiveDays')::int, 7));
  v_min numeric := coalesce((prefs ->> 'minAverage')::numeric, 8);
  v_dow int := extract(isodow from now() at time zone 'Africa/Casablanca')::int;
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
begin
  if uid is null or not (public.is_professor(uid) or public.is_admin(uid)) then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'copies', (
      select count(*) from public.exercise_submissions s
      join public.exercises e on e.id = s.exercise_id
      join public.courses c on c.id = e.course_id
      where c.professor_id = uid and s.status = 'submitted'
    ),
    'short_answers', coalesce((public.teacher_week_counts(uid) ->> 'short_answers')::int, 0),
    'closing', (
      select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'until', x.available_until, 'course_id', x.course_id) order by x.available_until), '[]'::jsonb)
      from (select e.id, e.title, e.available_until, e.course_id from public.exams e
            join public.courses c on c.id = e.course_id
            where c.professor_id = uid and e.is_visible
              and e.available_until between now() and now() + interval '48 hours'
            order by e.available_until limit 8) x
    ),
    -- appel non fait : classe dont l'appel a déjà été fait ce jour de la semaine ces 3 dernières semaines
    'attendance', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name) order by r.name), '[]'::jsonb)
      from public.rooms r
      where r.professor_id = uid and r.archived_at is null
        and exists (select 1 from public.attendance a where a.room_id = r.id
                    and a.session_date between v_today - 21 and v_today - 1
                    and extract(isodow from a.session_date)::int = v_dow)
        and not exists (select 1 from public.attendance a where a.room_id = r.id and a.session_date = v_today)
    ),
    'inactive', (
      select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'room', x.room) order by x.name), '[]'::jsonb)
      from (select p.id, p.name, r.name as room from public.profiles p
            join public.rooms r on r.id = p.room_id and r.professor_id = uid and r.archived_at is null
            where p.role = 'student'
              and not exists (select 1 from public.student_sessions ss where ss.student_id = p.id
                              and ss.last_activity > now() - make_interval(days => v_days))
            order by p.name limit 30) x
    ),
    'low', (
      select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'avg', x.avg) order by x.avg), '[]'::jsonb)
      from (select p.id, p.name, round(avg(20.0 * qs.score / nullif(qs.total_points, 0)), 1) as avg
            from public.profiles p
            join public.rooms r on r.id = p.room_id and r.professor_id = uid and r.archived_at is null
            join public.quiz_submissions qs on qs.student_id = p.id and qs.is_completed and qs.submitted_at > now() - interval '60 days'
            where p.role = 'student'
            group by p.id, p.name
            having avg(20.0 * qs.score / nullif(qs.total_points, 0)) < v_min
            order by 3 limit 30) x
    ),
    'thresholds', jsonb_build_object('inactiveDays', v_days, 'minAverage', v_min)
  );
end;
$$;
revoke execute on function public.teacher_today() from public, anon;
grant execute on function public.teacher_today() to authenticated;

-- ---------------------------------------------------------------------
-- F. Élève : chapitres lus, progression, rappels
-- ---------------------------------------------------------------------
create table if not exists public.course_progress (
  student_id    uuid not null references auth.users(id) on delete cascade,
  course_id     uuid not null references public.courses(id) on delete cascade,
  opened_at     timestamptz not null default now(),
  read_at       timestamptz,
  last_position jsonb,
  primary key (student_id, course_id)
);
alter table public.course_progress enable row level security;
grant select, insert, update, delete on public.course_progress to authenticated;
drop policy if exists "Progression perso" on public.course_progress;
create policy "Progression perso" on public.course_progress for all to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
drop policy if exists "Progression lue par le professeur" on public.course_progress;
create policy "Progression lue par le professeur" on public.course_progress for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and (c.professor_id = (select auth.uid()) or public.is_admin(auth.uid()))));

create or replace function public.my_progress()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_days date[];
  v_streak int := 0;
  v_d date := (now() at time zone 'Africa/Casablanca')::date;
begin
  if uid is null then return '{}'::jsonb; end if;
  select array_agg(distinct d order by d desc) into v_days from (
    select (ss.session_start at time zone 'Africa/Casablanca')::date as d from public.student_sessions ss where ss.student_id = uid
    union select (qs.submitted_at at time zone 'Africa/Casablanca')::date from public.quiz_submissions qs where qs.student_id = uid
    union select (es.submitted_at at time zone 'Africa/Casablanca')::date from public.exercise_submissions es where es.student_id = uid
  ) t where d is not null;
  -- série : jours consécutifs jusqu'à aujourd'hui (ou hier, si l'élève n'est pas encore venu aujourd'hui)
  if v_days is not null and array_length(v_days, 1) > 0 then
    if v_days[1] = v_d - 1 then v_d := v_d - 1; end if;
    while v_d = any (v_days) loop
      v_streak := v_streak + 1;
      v_d := v_d - 1;
    end loop;
  end if;

  return jsonb_build_object(
    'streak', v_streak,
    'active_days', coalesce(array_length(v_days, 1), 0),
    'quizzes', (
      select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'exam_id', x.exam_id, 'title', x.title, 'course', x.course,
                    'score', x.score, 'total', x.total_points, 'at', x.submitted_at) order by x.submitted_at desc), '[]'::jsonb)
      from (select qs.id, qs.exam_id, e.title, c.title as course, qs.score, qs.total_points, qs.submitted_at
            from public.quiz_submissions qs
            join public.exams e on e.id = qs.exam_id
            left join public.courses c on c.id = e.course_id
            where qs.student_id = uid and qs.is_completed
            order by qs.submitted_at desc limit 60) x
    ),
    'exercises_submitted', (select count(*) from public.exercise_submissions es where es.student_id = uid),
    'exercises_returned', (
      select coalesce(jsonb_agg(jsonb_build_object('title', e.title, 'grade', es.grade, 'max', es.max_grade, 'at', es.returned_at) order by es.returned_at desc), '[]'::jsonb)
      from public.exercise_submissions es join public.exercises e on e.id = es.exercise_id
      where es.student_id = uid and es.status = 'returned' and es.grade is not null
    ),
    'courses_read', (select count(*) from public.course_progress cp where cp.student_id = uid and cp.read_at is not null),
    'perfect_quizzes', (select count(*) from public.quiz_submissions qs where qs.student_id = uid and qs.is_completed and qs.total_points > 0 and qs.score >= qs.total_points)
  );
end;
$$;
revoke execute on function public.my_progress() from public, anon;
grant execute on function public.my_progress() to authenticated;

create table if not exists public.student_reminders (
  student_id uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  ref_id     uuid not null,
  sent_at    timestamptz not null default now(),
  primary key (student_id, kind, ref_id)
);
alter table public.student_reminders enable row level security;

-- Rappels de la veille : exercice à rendre demain, examen ou quiz qui ferme demain
create or replace function public.send_student_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n int := 0; k int;
  v_tomorrow date := (now() at time zone 'Africa/Casablanca')::date + 1;
begin
  with targets as (
    select p.id as student_id, 'exercise'::text as kind, e.id as ref_id, e.title, c.id as course_id
    from public.exercises e
    join public.courses c on c.id = e.course_id and c.is_visible
    join public.profiles p on p.room_id = c.room_id and p.role = 'student'
    where e.is_visible and (e.due_date at time zone 'Africa/Casablanca')::date = v_tomorrow
      and not exists (select 1 from public.exercise_submissions s where s.exercise_id = e.id and s.student_id = p.id)
    union all
    select p.id, 'exam', x.id, x.title, c.id
    from public.exams x
    join public.courses c on c.id = x.course_id and c.is_visible
    join public.profiles p on p.room_id = c.room_id and p.role = 'student'
    where x.is_visible
      and (coalesce(x.available_until, x.exam_date) at time zone 'Africa/Casablanca')::date = v_tomorrow
      and not exists (select 1 from public.quiz_submissions s where s.exam_id = x.id and s.student_id = p.id and s.is_completed)
  ), fresh as (
    insert into public.student_reminders (student_id, kind, ref_id)
    select t.student_id, t.kind, t.ref_id from targets t
    where coalesce((select (u.data -> 'notify' ->> 'reminders')::boolean from public.user_prefs u where u.user_id = t.student_id), true)
    on conflict do nothing
    returning student_id, kind, ref_id
  )
  insert into public.notifications (user_id, title, message, type, exercise_id, exam_id, course_id)
  select f.student_id,
         case when f.kind = 'exercise' then 'Exercice à rendre demain' else 'Évaluation demain' end,
         t.title, 'reminder',
         case when f.kind = 'exercise' then f.ref_id end,
         case when f.kind = 'exam' then f.ref_id end,
         t.course_id
  from fresh f join targets t on t.student_id = f.student_id and t.kind = f.kind and t.ref_id = f.ref_id;
  get diagnostics k = row_count;
  n := n + k;
  return n;
end;
$$;
revoke execute on function public.send_student_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- G. Portail parents
-- ---------------------------------------------------------------------
create table if not exists public.parent_links (
  token          text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  student_id     uuid not null references auth.users(id) on delete cascade,
  created_by     uuid not null default auth.uid(),
  label          text,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz,
  revoked_at     timestamptz,
  last_viewed_at timestamptz,
  views          int not null default 0
);
create index if not exists idx_parent_links_student on public.parent_links (student_id);
alter table public.parent_links enable row level security;
grant select, update, delete on public.parent_links to authenticated;
drop policy if exists "Liens parents du professeur" on public.parent_links;
create policy "Liens parents du professeur" on public.parent_links for all to authenticated
  using (created_by = (select auth.uid()) or public.is_admin(auth.uid()))
  with check (created_by = (select auth.uid()) or public.is_admin(auth.uid()));

create table if not exists public.parent_messages (
  id          uuid primary key default gen_random_uuid(),
  token       text not null references public.parent_links(token) on delete cascade,
  student_id  uuid not null references auth.users(id) on delete cascade,
  teacher_id  uuid not null,
  parent_name text,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists idx_parent_messages_teacher on public.parent_messages (teacher_id, created_at desc);
alter table public.parent_messages enable row level security;
grant select, update, delete on public.parent_messages to authenticated;
drop policy if exists "Messages des parents" on public.parent_messages;
create policy "Messages des parents" on public.parent_messages for all to authenticated
  using (teacher_id = (select auth.uid()) or public.is_admin(auth.uid()))
  with check (teacher_id = (select auth.uid()) or public.is_admin(auth.uid()));

create or replace function public.create_parent_link(p_student uuid, p_days int default 365)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if not exists (select 1 from public.profiles p where p.id = p_student and p.role = 'student' and public.owns_room(p.room_id)) then
    raise exception 'Accès refusé';
  end if;
  if not public.has_permission('parents.links') then raise exception 'Fonction non incluse dans votre offre'; end if;
  insert into public.parent_links (student_id, expires_at)
  values (p_student, case when p_days is null or p_days <= 0 then null else now() + make_interval(days => p_days) end)
  returning token into v_token;
  return v_token;
end;
$$;
revoke execute on function public.create_parent_link(uuid, int) from public, anon;
grant execute on function public.create_parent_link(uuid, int) to authenticated;

-- Bulletin en lecture seule (appelé sans compte, avec le jeton du lien)
create or replace function public.parent_report(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  l public.parent_links;
  s public.profiles;
  v_room public.rooms;
  v_today date := (now() at time zone 'Africa/Casablanca')::date;
begin
  select * into l from public.parent_links where token = p_token;
  if l.token is null or l.revoked_at is not null or (l.expires_at is not null and l.expires_at < now()) then
    return jsonb_build_object('error', 'invalid');
  end if;
  if coalesce((select (a.data -> 'features' ->> 'parents')::boolean from public.app_settings a where a.id = 1), true) = false then
    return jsonb_build_object('error', 'disabled');
  end if;
  select * into s from public.profiles where id = l.student_id;
  select * into v_room from public.rooms where id = s.room_id;
  update public.parent_links set views = views + 1, last_viewed_at = now() where token = p_token;

  return jsonb_build_object(
    'student', s.name,
    'room', v_room.name,
    'teacher', (select p.name from public.profiles p where p.id = v_room.professor_id),
    'quizzes', (
      select coalesce(jsonb_agg(jsonb_build_object('title', x.title, 'score', x.score, 'total', x.total_points, 'at', x.submitted_at) order by x.submitted_at desc), '[]'::jsonb)
      from (select e.title, qs.score, qs.total_points, qs.submitted_at from public.quiz_submissions qs
            join public.exams e on e.id = qs.exam_id
            where qs.student_id = s.id and qs.is_completed order by qs.submitted_at desc limit 30) x
    ),
    'exercises', (
      select coalesce(jsonb_agg(jsonb_build_object('title', e.title, 'grade', es.grade, 'max', es.max_grade, 'status', es.status, 'late', es.is_late, 'at', es.submitted_at) order by es.submitted_at desc), '[]'::jsonb)
      from public.exercise_submissions es join public.exercises e on e.id = es.exercise_id
      where es.student_id = s.id
    ),
    'marks', (
      select coalesce(jsonb_agg(jsonb_build_object('term', g.term, 'title', g.title, 'value', m.value, 'max', g.max_points, 'absent', m.absent) order by g.term, g.position), '[]'::jsonb)
      from public.gradebook_columns g join public.gradebook_marks m on m.column_id = g.id and m.student_id = s.id
      where g.room_id = s.room_id
    ),
    'attendance', jsonb_build_object(
      'absent', (select count(*) from public.attendance a where a.student_id = s.id and a.room_id = s.room_id and a.status = 'absent'),
      'late', (select count(*) from public.attendance a where a.student_id = s.id and a.room_id = s.room_id and a.status = 'late'),
      'excused', (select count(*) from public.attendance a where a.student_id = s.id and a.room_id = s.room_id and a.status = 'excused'),
      'recent', (select coalesce(jsonb_agg(jsonb_build_object('date', x.session_date, 'status', x.status) order by x.session_date desc), '[]'::jsonb)
                 from (select a.session_date, a.status from public.attendance a
                       where a.student_id = s.id and a.room_id = s.room_id and a.status <> 'present'
                       order by a.session_date desc limit 10) x)
    ),
    'homework', (
      select coalesce(jsonb_agg(jsonb_build_object('date', x.lesson_date, 'title', x.title, 'homework', x.homework, 'due', x.homework_due) order by x.homework_due nulls last), '[]'::jsonb)
      from (select ll.lesson_date, ll.title, ll.homework, ll.homework_due from public.lesson_log ll
            where ll.room_id = s.room_id and coalesce(ll.homework, '') <> ''
              and coalesce(ll.homework_due, ll.lesson_date) >= v_today - 7
            order by coalesce(ll.homework_due, ll.lesson_date) limit 15) x
    ),
    'appreciations', (
      select coalesce(jsonb_agg(jsonb_build_object('term', a.term, 'text', a.text) order by a.term), '[]'::jsonb)
      from public.student_appreciations a where a.student_id = s.id and a.room_id = s.room_id
    )
  );
end;
$$;
revoke execute on function public.parent_report(text) from public;
grant execute on function public.parent_report(text) to anon, authenticated;

create or replace function public.parent_send_message(p_token text, p_name text, p_body text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare l public.parent_links; v_teacher uuid; v_student text;
begin
  select * into l from public.parent_links where token = p_token;
  if l.token is null or l.revoked_at is not null or (l.expires_at is not null and l.expires_at < now()) then return false; end if;
  if coalesce(trim(p_body), '') = '' then return false; end if;
  -- au plus 5 messages par lien et par jour
  if (select count(*) from public.parent_messages m where m.token = p_token and m.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Trop de messages aujourd''hui';
  end if;
  select r.professor_id, p.name into v_teacher, v_student
  from public.profiles p join public.rooms r on r.id = p.room_id where p.id = l.student_id;
  if v_teacher is null then return false; end if;
  insert into public.parent_messages (token, student_id, teacher_id, parent_name, body)
  values (p_token, l.student_id, v_teacher, left(nullif(trim(p_name), ''), 120), left(trim(p_body), 2000));
  insert into public.notifications (user_id, title, message, type)
  values (v_teacher, 'Message d''un parent', coalesce(v_student, '') || ' : ' || left(trim(p_body), 140), 'info');
  return true;
end;
$$;
revoke execute on function public.parent_send_message(text, text, text) from public;
grant execute on function public.parent_send_message(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- H1. Support : tickets
-- ---------------------------------------------------------------------
create table if not exists public.support_tickets (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject    text not null check (char_length(subject) between 2 and 200),
  category   text not null default 'question' check (category in ('question', 'bug', 'payment', 'idea')),
  status     text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_support_tickets_author on public.support_tickets (author_id, updated_at desc);
create index if not exists idx_support_tickets_status on public.support_tickets (status, updated_at desc);

create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  author_id  uuid not null default auth.uid(),
  is_staff   boolean not null default false,
  body       text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists idx_support_messages_ticket on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;

drop policy if exists "Tickets lecture" on public.support_tickets;
create policy "Tickets lecture" on public.support_tickets for select to authenticated
  using (author_id = (select auth.uid()) or public.has_admin_permission('admin.support.manage'));
drop policy if exists "Tickets création" on public.support_tickets;
create policy "Tickets création" on public.support_tickets for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'open');
drop policy if exists "Tickets statut" on public.support_tickets;
create policy "Tickets statut" on public.support_tickets for update to authenticated
  using (author_id = (select auth.uid()) or public.has_admin_permission('admin.support.manage'))
  with check (author_id = (select auth.uid()) or public.has_admin_permission('admin.support.manage'));

drop policy if exists "Messages lecture" on public.support_messages;
create policy "Messages lecture" on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id
                 and (t.author_id = (select auth.uid()) or public.has_admin_permission('admin.support.manage'))));
drop policy if exists "Messages envoi" on public.support_messages;
create policy "Messages envoi" on public.support_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.support_tickets t where t.id = ticket_id
                and (t.author_id = (select auth.uid()) or public.has_admin_permission('admin.support.manage')))
  );

create or replace function public.support_message_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets; v_staff boolean;
begin
  select * into t from public.support_tickets where id = new.ticket_id;
  v_staff := new.author_id <> t.author_id and public.has_admin_permission('admin.support.manage', new.author_id);
  if v_staff and not new.is_staff then
    update public.support_messages set is_staff = true where id = new.id;
  end if;
  update public.support_tickets set updated_at = now(),
    status = case when v_staff then 'answered' else 'open' end
  where id = t.id;
  if v_staff then
    insert into public.notifications (user_id, title, message, type)
    values (t.author_id, 'Réponse du support', t.subject, 'info');
  end if;
  return new;
end;
$$;
drop trigger if exists support_message_after on public.support_messages;
create trigger support_message_after after insert on public.support_messages
  for each row execute function public.support_message_after();

-- ---------------------------------------------------------------------
-- H2. Bibliothèque partagée entre professeurs (validée par l'administration)
-- ---------------------------------------------------------------------
create table if not exists public.library_items (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('course', 'quiz', 'lesson_plan')),
  title       text not null,
  description text,
  level       text,
  payload     jsonb not null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  imports     int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_library_status on public.library_items (status, created_at desc);
alter table public.library_items enable row level security;
grant select, delete on public.library_items to authenticated;
drop policy if exists "Bibliothèque lecture" on public.library_items;
create policy "Bibliothèque lecture" on public.library_items for select to authenticated
  using (owner_id = (select auth.uid())
         or public.has_admin_permission('admin.library.manage')
         or (status = 'approved' and public.is_professor(auth.uid())));
drop policy if exists "Bibliothèque retrait" on public.library_items;
create policy "Bibliothèque retrait" on public.library_items for delete to authenticated
  using (owner_id = (select auth.uid()) or public.has_admin_permission('admin.library.manage'));

-- Publier : on fige une copie (texte, questions) ; les fichiers restent chez l'auteur
create or replace function public.library_publish(p_kind text, p_source uuid, p_description text default null, p_level text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_payload jsonb; v_title text; v_id uuid;
begin
  if not public.has_permission('library.publish') then raise exception 'Fonction non incluse dans votre offre'; end if;
  if p_kind = 'course' then
    select c.title, jsonb_build_object(
      'title', c.title, 'description', c.description,
      'exercises', coalesce((select jsonb_agg(jsonb_build_object('title', e.title, 'description', e.description) order by e.created_at)
                             from public.exercises e where e.course_id = c.id), '[]'::jsonb))
    into v_title, v_payload
    from public.courses c where c.id = p_source and c.professor_id = auth.uid();
  elsif p_kind = 'quiz' then
    select x.title, jsonb_build_object(
      'title', x.title, 'description', x.description, 'type', x.type, 'duration_minutes', x.duration_minutes,
      'questions', coalesce((select jsonb_agg(jsonb_build_object(
          'question', q.question, 'question_type', q.question_type, 'points', q.points,
          'options', coalesce((select jsonb_agg(jsonb_build_object('text', o.option_text, 'is_correct', o.is_correct) order by o.option_order)
                               from public.quiz_options o where o.question_id = q.id), '[]'::jsonb)) order by q.question_order)
        from public.quiz_questions q where q.exam_id = x.id), '[]'::jsonb))
    into v_title, v_payload
    from public.exams x join public.courses c on c.id = x.course_id
    where x.id = p_source and c.professor_id = auth.uid();
  elsif p_kind = 'lesson_plan' then
    select lp.title, jsonb_build_object('title', lp.title, 'level', lp.level, 'language', lp.language, 'content', lp.content)
    into v_title, v_payload
    from public.lesson_plans lp where lp.id = p_source and lp.owner_id = auth.uid();
  else
    raise exception 'Type inconnu';
  end if;
  if v_payload is null then raise exception 'Contenu introuvable'; end if;
  insert into public.library_items (kind, title, description, level, payload)
  values (p_kind, v_title, nullif(trim(coalesce(p_description, '')), ''), nullif(trim(coalesce(p_level, '')), ''), v_payload)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.library_publish(text, uuid, text, text) from public, anon;
grant execute on function public.library_publish(text, uuid, text, text) to authenticated;

create or replace function public.library_review(p_item uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.library_items;
begin
  if not public.has_admin_permission('admin.library.manage') then raise exception 'Accès refusé'; end if;
  update public.library_items set status = case when p_approve then 'approved' else 'rejected' end,
    review_note = nullif(trim(coalesce(p_note, '')), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_item returning * into i;
  if i.id is not null then
    insert into public.notifications (user_id, title, message, type)
    values (i.owner_id, case when p_approve then 'Bibliothèque : contenu publié' else 'Bibliothèque : contenu refusé' end,
            i.title || coalesce(' — ' || i.review_note, ''), 'info');
  end if;
end;
$$;
revoke execute on function public.library_review(uuid, boolean, text) from public, anon;
grant execute on function public.library_review(uuid, boolean, text) to authenticated;

-- Importer : cours → dans une classe ; quiz → dans un cours ; fiche → dans mes fiches
create or replace function public.library_import(p_item uuid, p_room uuid default null, p_course uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare i public.library_items; v_id uuid; q jsonb; o jsonb; v_q uuid; n int := 0; m int;
begin
  if not public.has_permission('library.import') then raise exception 'Fonction non incluse dans votre offre'; end if;
  select * into i from public.library_items where id = p_item and (status = 'approved' or owner_id = auth.uid());
  if i.id is null then raise exception 'Contenu introuvable'; end if;
  if i.kind = 'course' then
    if p_room is null or not exists (select 1 from public.rooms r where r.id = p_room and r.professor_id = auth.uid()) then raise exception 'Classe invalide'; end if;
    insert into public.courses (title, description, room_id, professor_id, is_visible)
    values (i.payload ->> 'title', i.payload ->> 'description', p_room, auth.uid(), false) returning id into v_id;
    insert into public.exercises (title, description, course_id, is_visible)
    select e ->> 'title', e ->> 'description', v_id, false from jsonb_array_elements(i.payload -> 'exercises') e;
  elsif i.kind = 'quiz' then
    if p_course is null or not exists (select 1 from public.courses c where c.id = p_course and c.professor_id = auth.uid()) then raise exception 'Cours invalide'; end if;
    insert into public.exams (title, description, course_id, type, duration_minutes, is_visible)
    values (i.payload ->> 'title', i.payload ->> 'description', p_course, coalesce(i.payload ->> 'type', 'quiz'),
            coalesce((i.payload ->> 'duration_minutes')::int, 30), false) returning id into v_id;
    for q in select * from jsonb_array_elements(i.payload -> 'questions') loop
      n := n + 1;
      insert into public.quiz_questions (exam_id, question, question_type, points, question_order)
      values (v_id, q ->> 'question', coalesce(q ->> 'question_type', 'multiple_choice'), coalesce((q ->> 'points')::int, 1), n)
      returning id into v_q;
      m := 0;
      for o in select * from jsonb_array_elements(q -> 'options') loop
        m := m + 1;
        insert into public.quiz_options (question_id, option_text, is_correct, option_order)
        values (v_q, o ->> 'text', coalesce((o ->> 'is_correct')::boolean, false), m);
      end loop;
    end loop;
  else
    insert into public.lesson_plans (title, level, language, content)
    values (i.payload ->> 'title', i.payload ->> 'level', coalesce(i.payload ->> 'language', 'fr'), i.payload -> 'content')
    returning id into v_id;
  end if;
  update public.library_items set imports = imports + 1 where id = i.id;
  return v_id;
end;
$$;
revoke execute on function public.library_import(uuid, uuid, uuid) from public, anon;
grant execute on function public.library_import(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- I. Habilitations, journal, planification
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
  ('class.duplicate', 'classManagement', 'Dupliquer et archiver une classe', 'نسخ وأرشفة قسم', 'Duplicate and archive a class', 'feature', true, 16),
  ('parents.links', 'parents', 'Liens parents (bulletin en lecture seule)', 'روابط الآباء (كشف للاطلاع فقط)', 'Parent links (read-only report)', 'feature', true, 600),
  ('library.import', 'library', 'Importer depuis la bibliothèque partagée', 'الاستيراد من المكتبة المشتركة', 'Import from the shared library', 'feature', true, 610),
  ('library.publish', 'library', 'Publier dans la bibliothèque partagée', 'النشر في المكتبة المشتركة', 'Publish to the shared library', 'feature', true, 611),
  ('admin.support.manage', 'admin', 'Répondre aux tickets de support', 'الرد على تذاكر الدعم', 'Answer support tickets', 'admin', true, 980),
  ('admin.library.manage', 'admin', 'Valider la bibliothèque partagée', 'المصادقة على المكتبة المشتركة', 'Review the shared library', 'admin', true, 981)
on conflict (key) do update set module = excluded.module, label_fr = excluded.label_fr, label_ar = excluded.label_ar, label_en = excluded.label_en;

-- Les offres existantes reçoivent les nouvelles fonctions (à retirer ensuite offre par offre si besoin)
insert into public.plan_permissions (plan_id, permission_key, limit_value)
select p.id, k.key, null from public.plans p
cross join (values ('class.duplicate'), ('parents.links'), ('library.import'), ('library.publish')) as k(key)
on conflict (plan_id, permission_key) do nothing;

create table if not exists public.applied_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);
alter table public.applied_migrations enable row level security;
grant select on public.applied_migrations to authenticated;
drop policy if exists "Migrations lisibles par l'administration" on public.applied_migrations;
create policy "Migrations lisibles par l'administration" on public.applied_migrations for select to authenticated
  using (public.is_admin(auth.uid()));
insert into public.applied_migrations (name) values ('20261107090000_teacher_student_tools') on conflict do nothing;
insert into public.applied_migrations (name)
select '20261106090000_admin_tools' where to_regclass('public.promo_codes') is not null
on conflict do nothing;
insert into public.applied_migrations (name)
select '20261105090000_security_hardening' where to_regprocedure('public.student_login_email(text)') is not null
on conflict do nothing;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('publish-scheduled', 'student-reminders');
    perform cron.schedule('publish-scheduled', '*/10 * * * *', 'select public.publish_scheduled_content()');
    perform cron.schedule('student-reminders', '0 17 * * *', 'select public.send_student_reminders()');
  end if;
end $$;

-- Journal d'audit et temps réel
do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_trigger') then
    drop trigger if exists audit_library_items on public.library_items;
    create trigger audit_library_items after insert or update or delete on public.library_items
      for each row execute function public.audit_trigger();
  end if;
  begin
    alter publication supabase_realtime add table public.support_messages;
  exception when others then null;
  end;
end $$;
