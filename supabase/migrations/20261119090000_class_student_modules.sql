-- Habilitations des élèves par classe
-- Le professeur choisit, pour chaque classe, les modules que ses élèves voient
-- (rooms.student_modules : { "<module>": false } = module fermé ; clé absente = ouvert).
-- Modules : chat, courses, exercises, exams, meet, whiteboard, lessonLog, calendar, progress, lab3d
-- (mêmes clés que src/lib/classModules.ts).
-- Les professeurs et l'équipe d'administration ne sont jamais concernés.

alter table public.rooms
  add column if not exists student_modules jsonb not null default '{}'::jsonb;

comment on column public.rooms.student_modules is
  'Habilitations des élèves de la classe : {"module": false} = module masqué aux élèves';

-- Module fermé pour cet utilisateur dans cette classe ?
create or replace function public.class_module_off(p_room uuid, p_module text, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select uid is not null and p_room is not null
    and not public.is_professor(uid)
    and not exists (select 1 from public.user_roles r where r.user_id = uid)
    and exists (
      select 1 from public.rooms r
      where r.id = p_room and coalesce(r.student_modules ->> p_module, 'true') = 'false'
    );
$$;

-- Même chose à partir d'un cours (exercices, examens)
create or replace function public.class_module_off_course(p_course uuid, p_module text, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.class_module_off((select c.room_id from public.courses c where c.id = p_course), p_module, uid);
$$;

-- Messagerie : fermée si TOUTES les classes de l'élève chez ce professeur la ferment
create or replace function public.chat_class_off(p_teacher uuid, p_student uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
      select 1 from public.rooms r
      where r.professor_id = p_teacher and public.in_room(r.id, p_student)
        and coalesce(r.student_modules ->> 'chat', 'true') = 'false'
    )
    and not exists (
      select 1 from public.rooms r
      where r.professor_id = p_teacher and public.in_room(r.id, p_student)
        and coalesce(r.student_modules ->> 'chat', 'true') <> 'false'
    );
$$;

grant execute on function public.class_module_off(uuid, text, uuid) to authenticated, anon;
grant execute on function public.class_module_off_course(uuid, text, uuid) to authenticated, anon;
grant execute on function public.chat_class_off(uuid, uuid) to authenticated;

-- Exercices / examens : invisibles aux élèves quand le module est fermé
drop policy if exists "hab classe: exercices" on public.exercises;
create policy "hab classe: exercices" on public.exercises as restrictive for select
  using (not public.class_module_off_course(course_id, 'exercises', (select auth.uid())));

drop policy if exists "hab classe: examens" on public.exams;
create policy "hab classe: examens" on public.exams as restrictive for select
  using (not public.class_module_off_course(course_id, 'exams', (select auth.uid())));

-- Cahier de textes
drop policy if exists "hab classe: cahier de textes" on public.lesson_log;
create policy "hab classe: cahier de textes" on public.lesson_log as restrictive for select
  using (not public.class_module_off(room_id, 'lessonLog', (select auth.uid())));

-- Tableaux blancs
drop policy if exists "hab classe: tableaux" on public.class_whiteboards;
create policy "hab classe: tableaux" on public.class_whiteboards as restrictive for select
  using (not public.class_module_off(room_id, 'whiteboard', (select auth.uid())));

-- Réunions : liste et droit d'entrée (meet_join passe par meet_can_see)
drop policy if exists "hab classe: reunions" on public.meetings;
create policy "hab classe: reunions" on public.meetings as restrictive for select
  using (not public.class_module_off(room_id, 'meet', (select auth.uid())));

create or replace function public.meet_can_see(p_meeting uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select uid is not null and exists (
    select 1 from public.meetings m
    where m.id = p_meeting
      and (m.host_id = uid or (public.meet_module_on() and public.in_room(m.room_id, uid)
                               and not public.class_module_off(m.room_id, 'meet', uid)))
  );
$$;

-- Messagerie : l'élève ne peut plus écrire (le professeur, si)
create or replace function public.chat_can_send(p_conv uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select uid is not null and public.chat_module_on() and exists (
    select 1 from public.chat_conversations c
    where c.id = p_conv and (c.teacher_id = uid or c.student_id = uid)
      and public.chat_is_teacher_of(c.teacher_id, c.student_id)
      and public.has_permission('chat.students', c.teacher_id)
      and (uid = c.teacher_id or not c.closed_by_teacher)
      and (uid = c.teacher_id or not public.chat_class_off(c.teacher_id, c.student_id))
  );
$$;
