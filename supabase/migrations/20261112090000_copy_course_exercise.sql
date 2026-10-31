-- Copier un cours (avec supports, exercices, quiz/examens et scènes 3D) vers une classe,
-- et copier un exercice (avec ses pièces jointes) vers un cours. Les copies sont masquées aux élèves.
-- Les fichiers ne sont pas dupliqués dans le stockage : la copie référence les mêmes fichiers,
-- et l'application ne supprime un fichier qu'une fois sa dernière référence supprimée.

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

create or replace function public.duplicate_course(p_course_id uuid, p_target_room_id uuid, p_title text default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_c public.courses;
  v_dst_prof uuid;
  v_new uuid := gen_random_uuid();
  v_pos int;
  e record; x record;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_c from public.courses where id = p_course_id;
  if v_c.id is null then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
  select r.professor_id into v_dst_prof from public.rooms r where r.id = p_target_room_id;
  if v_dst_prof is null then raise exception 'TARGET_NOT_FOUND' using errcode = '42501'; end if;
  if not public.is_admin(v_uid) and (v_c.professor_id is distinct from v_uid or v_dst_prof is distinct from v_uid) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if public.is_professor(v_uid) and not public.has_permission('course.edit', v_uid) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  -- la copie se place à la fin des chapitres de la classe de destination
  select coalesce(max(position), 0) + 1 into v_pos from public.courses where room_id = p_target_room_id;

  insert into public.courses
  select (jsonb_populate_record(null::public.courses, to_jsonb(v_c) || jsonb_build_object(
    'id', v_new, 'room_id', p_target_room_id, 'professor_id', v_dst_prof,
    'title', coalesce(nullif(btrim(p_title), ''), v_c.title),
    'is_visible', false, 'publish_at', null, 'position', v_pos,
    'created_at', now(), 'updated_at', now()))).*;

  insert into public.course_materials
  select (jsonb_populate_record(null::public.course_materials, to_jsonb(m) || jsonb_build_object(
    'id', gen_random_uuid(), 'course_id', v_new, 'uploaded_at', now()))).*
  from public.course_materials m where m.course_id = p_course_id;

  for e in select id from public.exercises where course_id = p_course_id order by created_at loop
    perform public.duplicate_exercise(e.id, v_new, null);
  end loop;

  for x in select id from public.exams where course_id = p_course_id order by created_at loop
    perform public.duplicate_exam(x.id, v_new, null);
  end loop;

  if to_regclass('public.lab3d_scenes') is not null then
    insert into public.lab3d_scenes
    select (jsonb_populate_record(null::public.lab3d_scenes, to_jsonb(s) || jsonb_build_object(
      'id', gen_random_uuid(), 'room_id', p_target_room_id, 'course_id', v_new, 'professor_id', v_dst_prof,
      'is_visible', false, 'views', 0, 'created_at', now(), 'updated_at', now()))).*
    from public.lab3d_scenes s where s.course_id = p_course_id;
  end if;
  return v_new;
end $$;
revoke all on function public.duplicate_course(uuid, uuid, text) from public, anon;
grant execute on function public.duplicate_course(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
insert into public.applied_migrations (name) values ('20261112090000_copy_course_exercise') on conflict do nothing;
