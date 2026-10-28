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
