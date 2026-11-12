-- =====================================================================
-- Changer un élève de classe (avec ses données)
--
--   transfer_student(p_student, p_to_room) : le professeur (propriétaire des deux classes)
--   ou un admin déplace l'élève. En une seule opération :
--     - profil : room_id = nouvelle classe ;
--     - inscriptions : retirées des cours de l'ancienne classe, ajoutées aux cours de la
--       nouvelle (comme à la création d'un élève) ;
--     - suivent l'élève dans la nouvelle classe : présences, groupe de besoin, appréciations,
--       notes du carnet (colonne de même période / titre / type, créée si absente),
--       sessions et activités (suivi et classement) ;
--     - restent sur place : ses copies de quiz et d'exercices (elles appartiennent aux
--       évaluations de l'ancienne classe ; l'élève les garde dans son historique),
--       mais l'ancienne classe ne les compte plus (student_transfers).
--   student_transfers : historique des changements (qui, quand, d'où vers où).
--
-- À exécuter à la main dans le SQL Editor de Supabase, APRÈS
-- 20261030090000_teaching_tools.sql. Idempotent.
-- =====================================================================

create table if not exists public.student_transfers (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references auth.users(id) on delete cascade,
  from_room_id   uuid references public.rooms(id) on delete set null,
  to_room_id     uuid not null references public.rooms(id) on delete cascade,
  transferred_by uuid,
  transferred_at timestamptz not null default now(),
  moved          jsonb not null default '{}'::jsonb
);
create index if not exists idx_student_transfers_from on public.student_transfers (from_room_id, student_id);
create index if not exists idx_student_transfers_student on public.student_transfers (student_id, transferred_at desc);

alter table public.student_transfers enable row level security;
grant select on public.student_transfers to authenticated;
drop policy if exists "Transferts lisibles par le professeur" on public.student_transfers;
create policy "Transferts lisibles par le professeur" on public.student_transfers
  for select to authenticated
  using (student_id = auth.uid()
         or (from_room_id is not null and public.owns_room(from_room_id))
         or public.owns_room(to_room_id));

create or replace function public.transfer_student(p_student uuid, p_to_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from uuid;
  v_role text;
  v_n_att int := 0;
  v_n_marks int := 0;
  v_n_enr int := 0;
  v_n_sess int := 0;
  v_n_act int := 0;
  v_n_appr int := 0;
  v_n_grp int := 0;
  c record;
  v_col uuid;
begin
  select p.room_id, p.role into v_from, v_role from public.profiles p where p.id = p_student;
  if not found or v_role <> 'student' then
    raise exception 'Élève introuvable';
  end if;
  if not exists (select 1 from public.rooms r where r.id = p_to_room) then
    raise exception 'Classe introuvable';
  end if;
  -- ancienne classe : profil, sinon inscription
  if v_from is null then
    select e.room_id into v_from from public.enrollments e
    where e.student_id = p_student and e.room_id is not null and e.room_id <> p_to_room limit 1;
  end if;
  if v_from = p_to_room then
    raise exception 'L''élève est déjà dans cette classe';
  end if;
  if not public.owns_room(p_to_room) or (v_from is not null and not public.owns_room(v_from)) then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  if not public.is_admin(auth.uid()) and not public.has_permission('student.edit') then
    raise exception 'Habilitation « Modifier une fiche élève » requise' using errcode = '42501';
  end if;

  -- 1. Profil et inscriptions
  update public.profiles set room_id = p_to_room, updated_at = now() where id = p_student;
  delete from public.enrollments e
  where e.student_id = p_student
    and (e.room_id = v_from or e.course_id in (select co.id from public.courses co where co.room_id = v_from));
  insert into public.enrollments (student_id, course_id, room_id)
  select p_student, co.id, p_to_room from public.courses co
  where co.room_id = p_to_room
    and not exists (select 1 from public.enrollments e where e.student_id = p_student and e.course_id = co.id);
  get diagnostics v_n_enr = row_count;

  if v_from is not null then
    -- 2. Présences (une ligne déjà saisie dans la nouvelle classe le même jour / séance l'emporte)
    delete from public.attendance a
    where a.room_id = v_from and a.student_id = p_student
      and exists (select 1 from public.attendance b where b.room_id = p_to_room and b.student_id = p_student
                  and b.session_date = a.session_date and b.slot = a.slot);
    update public.attendance set room_id = p_to_room where room_id = v_from and student_id = p_student;
    get diagnostics v_n_att = row_count;

    -- 3. Groupe de besoin et appréciations (ce qui existe déjà dans la nouvelle classe est gardé)
    insert into public.student_need_groups (room_id, student_id, grp, updated_at)
    select p_to_room, g.student_id, g.grp, g.updated_at from public.student_need_groups g
    where g.room_id = v_from and g.student_id = p_student
    on conflict (room_id, student_id) do nothing;
    get diagnostics v_n_grp = row_count;
    delete from public.student_need_groups where room_id = v_from and student_id = p_student;

    insert into public.student_appreciations (room_id, student_id, term, text, updated_at)
    select p_to_room, a.student_id, a.term, a.text, a.updated_at from public.student_appreciations a
    where a.room_id = v_from and a.student_id = p_student
    on conflict (room_id, student_id, term) do nothing;
    get diagnostics v_n_appr = row_count;
    delete from public.student_appreciations where room_id = v_from and student_id = p_student;

    -- 4. Carnet de notes : même période, titre et type ; colonne créée si besoin
    for c in
      select gc.*, gm.value, gm.absent, gm.updated_at as mark_at
      from public.gradebook_marks gm
      join public.gradebook_columns gc on gc.id = gm.column_id
      where gc.room_id = v_from and gm.student_id = p_student
    loop
      select t.id into v_col from public.gradebook_columns t
      where t.room_id = p_to_room and t.term = c.term and t.kind = c.kind
        and lower(trim(t.title)) = lower(trim(c.title))
      order by t.position limit 1;
      if v_col is null then
        insert into public.gradebook_columns (room_id, term, title, kind, max_points, coef, position)
        values (p_to_room, c.term, c.title, c.kind, c.max_points, c.coef, c.position)
        returning id into v_col;
      end if;
      insert into public.gradebook_marks (column_id, student_id, value, absent, updated_at)
      values (v_col, p_student, c.value, c.absent, c.mark_at)
      on conflict (column_id, student_id) do nothing;
      delete from public.gradebook_marks where column_id = c.id and student_id = p_student;
      v_n_marks := v_n_marks + 1;
      v_col := null;
    end loop;

    -- 5. Suivi et classement
    update public.student_sessions set room_id = p_to_room where room_id = v_from and student_id = p_student;
    get diagnostics v_n_sess = row_count;
    update public.student_activities set room_id = p_to_room where room_id = v_from and student_id = p_student;
    get diagnostics v_n_act = row_count;
  end if;

  insert into public.student_transfers (student_id, from_room_id, to_room_id, transferred_by, moved)
  values (p_student, v_from, p_to_room, auth.uid(), jsonb_build_object(
    'attendance', v_n_att, 'gradebook_marks', v_n_marks, 'need_group', v_n_grp, 'appreciations', v_n_appr,
    'sessions', v_n_sess, 'activities', v_n_act, 'enrollments', v_n_enr));

  return jsonb_build_object('from_room_id', v_from, 'to_room_id', p_to_room,
    'attendance', v_n_att, 'gradebook_marks', v_n_marks, 'need_group', v_n_grp, 'appreciations', v_n_appr,
    'sessions', v_n_sess, 'activities', v_n_act, 'enrollments', v_n_enr);
end;
$$;

revoke all on function public.transfer_student(uuid, uuid) from public, anon;
grant execute on function public.transfer_student(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
