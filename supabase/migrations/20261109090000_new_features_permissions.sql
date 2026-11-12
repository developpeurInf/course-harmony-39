-- =====================================================================
-- Habilitations des fonctions ajoutées (lots 3 à 5 et support)
--   1. nouvelles clés dans le catalogue, données à toutes les offres existantes
--   2. contrôles côté serveur (base de données) pour chaque clé
--   3. fonctions côté élève soumises à l'offre de son professeur
--   4. droits séparés pour l'équipe support
-- À lancer après 20261108090000_support_desk.sql. Relançable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catalogue
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
  ('class.duplicate',      'classManagement',   'Dupliquer une classe (nouvelle année)', 'نسخ قسم (سنة جديدة)', 'Duplicate a class (new year)', 'feature', true, 16),
  ('class.archive',        'classManagement',   'Archiver / désarchiver une classe', 'أرشفة / إلغاء أرشفة قسم', 'Archive / unarchive a class', 'feature', true, 17),
  ('dashboard.today',      'studentActivities', 'Carte « À faire aujourd''hui » et alertes élèves', 'بطاقة « مهام اليوم » وتنبيهات التلاميذ', '“To do today” card and student alerts', 'feature', false, 205),
  ('student.notes',        'students',          'Notes privées sur un élève', 'ملاحظات خاصة عن تلميذ', 'Private notes on a student', 'feature', true, 118),
  ('student.print_cards',  'students',          'Imprimer les cartes d''identifiants', 'طباعة بطاقات الولوج', 'Print login cards', 'feature', false, 119),
  ('course.schedule',      'courses',           'Programmer la publication et réordonner les chapitres', 'برمجة النشر وإعادة ترتيب الفصول', 'Schedule publishing and reorder chapters', 'feature', true, 336),
  ('exercise.annotate',    'exercises',         'Annoter les copies et grilles de correction', 'التعليق على الأوراق وشبكات التصحيح', 'Annotate papers and grading rubrics', 'feature', true, 413),
  ('diagnostic.compare',   'diagnostic',        'Comparer deux évaluations diagnostiques', 'مقارنة تقويمين تشخيصيين', 'Compare two diagnostic assessments', 'feature', false, 539),
  ('parents.messages',     'parents',           'Recevoir les messages des parents', 'استقبال رسائل الآباء', 'Receive messages from parents', 'feature', true, 601),
  ('support.tickets',      'support',           'Contacter le support (tickets)', 'التواصل مع الدعم (تذاكر)', 'Contact support (tickets)', 'feature', true, 620),
  ('support.attachments',  'support',           'Joindre des fichiers au support (photos, vidéos, documents, vocal, position)', 'إرفاق ملفات للدعم (صور، فيديو، وثائق، صوت، موقع)', 'Attach files to support (photos, videos, documents, voice, location)', 'feature', true, 621),
  ('student.progress',     'progress',          'Page « Ma progression » pour mes élèves', 'صفحة « تقدمي » لتلاميذي', '“My progress” page for my students', 'feature', false, 630),
  ('student.badges',       'progress',          'Badges et séries pour mes élèves', 'الشارات والسلاسل لتلاميذي', 'Badges and streaks for my students', 'feature', false, 631),
  ('student.remediation_ai','progress',         'Exercices de remédiation IA pour mes élèves', 'تمارين الدعم بالذكاء الاصطناعي لتلاميذي', 'AI remediation exercises for my students', 'feature', true, 632),
  ('student.reminders',    'progress',          'Rappels automatiques de devoirs à mes élèves', 'تذكيرات تلقائية بالواجبات لتلاميذي', 'Automatic homework reminders to my students', 'feature', true, 633),
  ('admin.support.macros', 'admin',             'Gérer les réponses types du support', 'تدبير الردود الجاهزة للدعم', 'Manage support canned replies', 'admin', true, 982),
  ('admin.support.assign', 'admin',             'Assigner les tickets et changer leur priorité', 'إسناد التذاكر وتغيير أولويتها', 'Assign tickets and change priority', 'admin', true, 983)
on conflict (key) do update set module = excluded.module, label_fr = excluded.label_fr, label_ar = excluded.label_ar,
  label_en = excluded.label_en, is_write = excluded.is_write, sort_order = excluded.sort_order;

-- Les offres existantes reçoivent les nouvelles fonctions : rien ne disparaît pour les profs déjà abonnés.
-- Retirez-les ensuite offre par offre dans Administration → Offres.
insert into public.plan_permissions (plan_id, permission_key, limit_value)
select p.id, k.key, null from public.plans p
cross join (values
  ('class.archive'), ('dashboard.today'), ('student.notes'), ('student.print_cards'), ('course.schedule'),
  ('exercise.annotate'), ('diagnostic.compare'), ('parents.messages'), ('support.tickets'), ('support.attachments'),
  ('student.progress'), ('student.badges'), ('student.remediation_ai'), ('student.reminders')
) as k(key)
on conflict (plan_id, permission_key) do nothing;

-- ---------------------------------------------------------------------
-- 2. Contrôles côté serveur
-- ---------------------------------------------------------------------
-- Raccourci : la fonction est-elle accordée à l'utilisateur connecté ?
-- (les tâches planifiées et le service n'ont pas d'utilisateur : pas de contrôle)
create or replace function public.require_permission(p_key text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin(auth.uid()) then return; end if;
  if not public.has_permission(p_key) then
    raise exception 'Fonction non incluse dans votre offre (%)', p_key using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.require_permission(text) from public, anon;
grant execute on function public.require_permission(text) to authenticated;

-- Archiver une classe
create or replace function public.rooms_archive_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.archived_at is distinct from old.archived_at then perform public.require_permission('class.archive'); end if;
  return new;
end;
$$;
drop trigger if exists rooms_archive_guard on public.rooms;
create trigger rooms_archive_guard before update of archived_at on public.rooms
  for each row execute function public.rooms_archive_guard();

-- Programmer une publication (cours et exercices). La publication automatique remet publish_at à vide : pas de contrôle.
create or replace function public.publish_at_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.publish_at is not null and (tg_op = 'INSERT' or new.publish_at is distinct from old.publish_at) then
    perform public.require_permission('course.schedule');
  end if;
  return new;
end;
$$;
drop trigger if exists courses_publish_at_guard on public.courses;
create trigger courses_publish_at_guard before insert or update of publish_at on public.courses
  for each row execute function public.publish_at_guard();
drop trigger if exists exercises_publish_at_guard on public.exercises;
create trigger exercises_publish_at_guard before insert or update of publish_at on public.exercises
  for each row execute function public.publish_at_guard();

-- Réordonner les chapitres
create or replace function public.reorder_courses(p_room uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_room(p_room) then raise exception 'Accès refusé'; end if;
  perform public.require_permission('course.schedule');
  update public.courses c set position = x.ord
  from unnest(p_ids) with ordinality as x(id, ord)
  where c.id = x.id and c.room_id = p_room;
end;
$$;

-- Notes privées sur un élève
create or replace function public.student_notes_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission('student.notes');
  return new;
end;
$$;
drop trigger if exists student_notes_guard on public.student_notes;
create trigger student_notes_guard before insert or update on public.student_notes
  for each row execute function public.student_notes_guard();

-- Tableau « À faire aujourd'hui »
do $$
begin
  if to_regprocedure('public.teacher_today()') is not null
     and to_regprocedure('public.teacher_today_core()') is null then
    alter function public.teacher_today() rename to teacher_today_core;
    revoke execute on function public.teacher_today_core() from public, anon, authenticated;
  end if;
end $$;
create or replace function public.teacher_today()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) and not public.has_permission('dashboard.today') then
    return null;
  end if;
  return public.teacher_today_core();
end;
$$;
revoke execute on function public.teacher_today() from public, anon;
grant execute on function public.teacher_today() to authenticated;

-- Messages des parents : refusés si le professeur n'a pas la fonction
create or replace function public.parent_send_message(p_token text, p_name text, p_body text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare l public.parent_links; v_teacher uuid; v_student text;
begin
  select * into l from public.parent_links where token = p_token;
  if l.token is null or l.revoked_at is not null or (l.expires_at is not null and l.expires_at < now()) then return false; end if;
  if coalesce(trim(p_body), '') = '' then return false; end if;
  if (select count(*) from public.parent_messages m where m.token = p_token and m.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Trop de messages aujourd''hui';
  end if;
  select r.professor_id, p.name into v_teacher, v_student
  from public.profiles p join public.rooms r on r.id = p.room_id where p.id = l.student_id;
  if v_teacher is null or not public.has_permission('parents.messages', v_teacher) then return false; end if;
  insert into public.parent_messages (token, student_id, teacher_id, parent_name, body)
  values (p_token, l.student_id, v_teacher, left(nullif(trim(p_name), ''), 120), left(trim(p_body), 2000));
  insert into public.notifications (user_id, title, message, type)
  values (v_teacher, 'Message d''un parent', coalesce(v_student, '') || ' : ' || left(trim(p_body), 140), 'info');
  return true;
end;
$$;
revoke execute on function public.parent_send_message(text, text, text) from public;
grant execute on function public.parent_send_message(text, text, text) to anon, authenticated;

-- Le portail parent sait si la messagerie est ouverte
create or replace function public.parent_can_message(p_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.has_permission('parents.messages', r.professor_id)
    from public.parent_links l
    join public.profiles p on p.id = l.student_id
    join public.rooms r on r.id = p.room_id
    where l.token = p_token and l.revoked_at is null and (l.expires_at is null or l.expires_at > now())
  ), false);
$$;
revoke execute on function public.parent_can_message(text) from public;
grant execute on function public.parent_can_message(text) to anon, authenticated;

-- Support : créer un ticket (professeurs) et joindre des fichiers
create or replace function public.support_create_ticket(p_subject text, p_category text, p_body text, p_priority text default 'normal')
returns public.support_tickets language plpgsql security definer set search_path = '' as $$
declare t public.support_tickets;
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if public.is_professor(auth.uid()) then perform public.require_permission('support.tickets'); end if;
  if char_length(coalesce(trim(p_body), '')) = 0 then raise exception 'Message vide'; end if;
  if (select count(*) from public.support_tickets where author_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Trop de demandes aujourd''hui, réessayez demain.';
  end if;
  insert into public.support_tickets (author_id, subject, category, priority)
  values (auth.uid(), trim(p_subject), coalesce(p_category, 'question'),
          case when p_priority in ('low', 'normal', 'high', 'urgent') then p_priority else 'normal' end)
  returning * into t;
  insert into public.support_messages (ticket_id, author_id, body) values (t.id, auth.uid(), trim(p_body));
  select * into t from public.support_tickets where id = t.id;
  return t;
end;
$$;

drop policy if exists "Tickets création" on public.support_tickets;
create policy "Tickets création" on public.support_tickets for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'open'
              and (not public.is_professor((select auth.uid())) or public.has_permission('support.tickets')));

drop policy if exists "support pj depot" on storage.objects;
create policy "support pj depot" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and public.support_can_access_ticket((storage.foldername(name))[1])
    and (public.has_admin_permission('admin.support.manage') or public.has_permission('support.attachments'))
  );

create or replace function public.support_attachments_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (jsonb_array_length(coalesce(new.attachments, '[]'::jsonb)) > 0 or new.location is not null)
     and not public.has_admin_permission('admin.support.manage') then
    perform public.require_permission('support.attachments');
  end if;
  return new;
end;
$$;
drop trigger if exists support_attachments_guard on public.support_messages;
create trigger support_attachments_guard before insert on public.support_messages
  for each row execute function public.support_attachments_guard();

-- ---------------------------------------------------------------------
-- 3. Côté élève : selon l'offre de son professeur
-- ---------------------------------------------------------------------
create or replace function public.student_teacher_can(p_key text, p_student uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.has_permission(p_key, r.professor_id)
    from public.profiles p join public.rooms r on r.id = p.room_id
    where p.id = p_student
  ), false);
$$;
revoke execute on function public.student_teacher_can(text, uuid) from public, anon;
grant execute on function public.student_teacher_can(text, uuid) to authenticated;

-- Ce que l'élève connecté a le droit de voir (un professeur voit tout)
create or replace function public.student_features()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'student') then
    return jsonb_build_object('progress', true, 'badges', true, 'remediation', true, 'reminders', true);
  end if;
  return jsonb_build_object(
    'progress',    public.student_teacher_can('student.progress'),
    'badges',      public.student_teacher_can('student.badges'),
    'remediation', public.student_teacher_can('student.remediation_ai'),
    'reminders',   public.student_teacher_can('student.reminders')
  );
end;
$$;
revoke execute on function public.student_features() from public, anon;
grant execute on function public.student_features() to authenticated;

-- Rappels : seulement pour les élèves dont le professeur a la fonction
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
    join public.rooms r on r.id = c.room_id
    join public.profiles p on p.room_id = c.room_id and p.role = 'student'
    where e.is_visible and (e.due_date at time zone 'Africa/Casablanca')::date = v_tomorrow
      and public.has_permission('student.reminders', r.professor_id)
      and not exists (select 1 from public.exercise_submissions s where s.exercise_id = e.id and s.student_id = p.id)
    union all
    select p.id, 'exam', x.id, x.title, c.id
    from public.exams x
    join public.courses c on c.id = x.course_id and c.is_visible
    join public.rooms r on r.id = c.room_id
    join public.profiles p on p.room_id = c.room_id and p.role = 'student'
    where x.is_visible
      and (coalesce(x.available_until, x.exam_date) at time zone 'Africa/Casablanca')::date = v_tomorrow
      and public.has_permission('student.reminders', r.professor_id)
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
-- 4. Équipe support : assignation / priorité et réponses types
-- ---------------------------------------------------------------------
create or replace function public.support_ticket_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;

  if not public.has_admin_permission('admin.support.manage') then
    new.number := old.number;
    new.author_id := old.author_id;
    new.priority := old.priority;
    new.assigned_to := old.assigned_to;
    new.staff_read_at := old.staff_read_at;
    new.last_message_at := old.last_message_at;
    new.last_message_preview := old.last_message_preview;
    new.last_from_staff := old.last_from_staff;
    new.created_at := old.created_at;
    if new.status is distinct from old.status and new.status not in ('open', 'closed') then
      new.status := old.status;
    end if;
    if new.rating is distinct from old.rating and new.status <> 'closed' then
      new.rating := old.rating;
      new.rating_comment := old.rating_comment;
    end if;
  elsif not public.has_admin_permission('admin.support.assign') then
    -- membre de l'équipe sans droit d'assignation : peut seulement se l'attribuer
    if new.priority is distinct from old.priority then new.priority := old.priority; end if;
    if new.assigned_to is distinct from old.assigned_to and new.assigned_to is distinct from auth.uid() then
      new.assigned_to := old.assigned_to;
    end if;
  end if;

  if new.status = 'closed' and old.status <> 'closed' then
    new.closed_at := now();
  elsif new.status <> 'closed' then
    new.closed_at := null;
  end if;
  return new;
end;
$$;

drop policy if exists "Réponses types équipe" on public.support_macros;
drop policy if exists "Réponses types lecture" on public.support_macros;
drop policy if exists "Réponses types gestion" on public.support_macros;
create policy "Réponses types lecture" on public.support_macros for select to authenticated
  using (public.has_admin_permission('admin.support.manage'));
create policy "Réponses types gestion" on public.support_macros for all to authenticated
  using (public.has_admin_permission('admin.support.macros'))
  with check (public.has_admin_permission('admin.support.macros'));

-- Les membres de l'équipe qui répondaient déjà au support gardent tout le support
update public.user_roles
set admin_permissions = array(select distinct unnest(admin_permissions || array['admin.support.macros', 'admin.support.assign']))
where admin_permissions is not null and 'admin.support.manage' = any (admin_permissions)
  and not (admin_permissions @> array['admin.support.macros', 'admin.support.assign']);

insert into public.applied_migrations (name) values ('20261109090000_new_features_permissions') on conflict do nothing;
