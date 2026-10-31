-- Correctif de la copie : exercises.due_date et exams.exam_date sont obligatoires (NOT NULL).
-- La copie garde donc la date d'origine (masquée aux élèves, le professeur l'ajuste avant de publier).
-- Corrige aussi « Dupliquer une classe », qui échouait dès qu'une classe contenait un exercice ou un examen,
-- et lui fait recopier les pièces jointes des exercices.

create or replace function public.duplicate_exercise(p_exercise_id uuid, p_target_course_id uuid, p_title text default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ex public.exercises;
  v_src_prof uuid;
  v_dst_prof uuid;
  v_new uuid := gen_random_uuid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_ex from public.exercises where id = p_exercise_id;
  if v_ex.id is null then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  select c.professor_id into v_src_prof from public.courses c where c.id = v_ex.course_id;
  select c.professor_id into v_dst_prof from public.courses c where c.id = p_target_course_id;
  if v_dst_prof is null then raise exception 'TARGET_NOT_FOUND' using errcode = '42501'; end if;
  if not public.is_admin(v_uid) and (v_src_prof is distinct from v_uid or v_dst_prof is distinct from v_uid) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if public.is_professor(v_uid) and not public.has_permission('exercise.edit', v_uid) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  insert into public.exercises
  select (jsonb_populate_record(null::public.exercises, to_jsonb(v_ex) || jsonb_build_object(
    'id', v_new, 'course_id', p_target_course_id,
    'title', coalesce(nullif(btrim(p_title), ''), v_ex.title),
    'is_visible', false, 'publish_at', null,
    'created_at', now(), 'updated_at', now()))).*;

  if to_regclass('public.exercise_materials') is not null then
    insert into public.exercise_materials
    select (jsonb_populate_record(null::public.exercise_materials, to_jsonb(m) || jsonb_build_object(
      'id', gen_random_uuid(), 'exercise_id', v_new, 'uploaded_at', now()))).*
    from public.exercise_materials m where m.exercise_id = p_exercise_id;
  end if;
  return v_new;
end $$;
revoke all on function public.duplicate_exercise(uuid, uuid, text) from public, anon;
grant execute on function public.duplicate_exercise(uuid, uuid, text) to authenticated;

create or replace function public.duplicate_room(p_room uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_room uuid;
  c record; e record; x record; q record;
  v_course uuid; v_exam uuid; v_q uuid; v_ex uuid;
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
      v_ex := gen_random_uuid();
      insert into public.exercises
      select (jsonb_populate_record(null::public.exercises, to_jsonb(e) || jsonb_build_object(
        'id', v_ex, 'course_id', v_course, 'is_visible', false,
        'publish_at', null, 'created_at', now(), 'updated_at', now()))).*;
      if to_regclass('public.exercise_materials') is not null then
        insert into public.exercise_materials
        select (jsonb_populate_record(null::public.exercise_materials, to_jsonb(m) || jsonb_build_object(
          'id', gen_random_uuid(), 'exercise_id', v_ex, 'uploaded_at', now()))).*
        from public.exercise_materials m where m.exercise_id = e.id;
      end if;
    end loop;

    for x in select * from public.exams where course_id = c.id loop
      v_exam := gen_random_uuid();
      insert into public.exams
      select (jsonb_populate_record(null::public.exams, to_jsonb(x) || jsonb_build_object(
        'id', v_exam, 'course_id', v_course, 'is_visible', false,
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

notify pgrst, 'reload schema';
insert into public.applied_migrations (name) values ('20261112100000_copy_fix_dates') on conflict do nothing;
