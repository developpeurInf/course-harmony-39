-- =====================================================================
-- Réunions vidéo de classe (« Meet »)
--   • le professeur d'une classe crée une réunion : tout de suite ou planifiée
--   • seuls le professeur et les élèves de CETTE classe peuvent la voir et la rejoindre
--     (RLS + fonction meet_join, appelée par /api/meet/token avant de donner
--     le jeton LiveKit)
--   • chat dédié à chaque réunion (meeting_messages), conservé après la réunion
--   • présence automatique : chaque entrée / sortie est notée (meeting_attendance)
--     → rapport de présence par élève (meet_report)
--   • élèves exclus par le professeur : ne peuvent plus revenir dans la réunion
--   • habilitation : meet.host (module « meet »)
-- À lancer après 20261115090000_chat_video_classes.sql. Relançable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Habilitation (catalogue + toutes les offres existantes)
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
  ('meet.host', 'meet', 'Réunions vidéo dans mes classes (visio, partage d''écran, chat)', 'اجتماعات الفيديو في أقسامي (فيديو، مشاركة الشاشة، دردشة)', 'Video meetings in my classes (video, screen sharing, chat)', 'feature', true, 660)
on conflict (key) do update set module = excluded.module, label_fr = excluded.label_fr, label_ar = excluded.label_ar,
  label_en = excluded.label_en, is_write = excluded.is_write, sort_order = excluded.sort_order;

insert into public.plan_permissions (plan_id, permission_key, limit_value)
select p.id, 'meet.host', null from public.plans p
on conflict (plan_id, permission_key) do nothing;

-- Module allumé par l'administration (Personnalisation → Modules)
create or replace function public.meet_module_on()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (a.data -> 'features' ->> 'meet')::boolean from public.app_settings a where a.id = 1), true);
$$;
revoke execute on function public.meet_module_on() from public, anon;
grant execute on function public.meet_module_on() to authenticated;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 160),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  scheduled_at timestamptz,
  duration_min int not null default 60 check (duration_min between 5 and 600),
  started_at timestamptz,
  ended_at timestamptz,
  host_seen_at timestamptz,
  -- chat, micro / caméra / écran des élèves, verrouillage
  settings jsonb not null default '{"chat": true, "students_mic": true, "students_cam": true, "students_share": false, "locked": false}'::jsonb,
  kicked uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meetings_room_idx on public.meetings (room_id, status, scheduled_at desc);
create index if not exists meetings_host_idx on public.meetings (host_id, status);

create table if not exists public.meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz
);
create index if not exists meeting_attendance_idx on public.meeting_attendance (meeting_id, user_id);

create table if not exists public.meeting_messages (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  client_id text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists meeting_messages_idx on public.meeting_messages (meeting_id, created_at);

alter table public.meetings enable row level security;
alter table public.meeting_attendance enable row level security;
alter table public.meeting_messages enable row level security;

-- ---------------------------------------------------------------------
-- 2. Règles d'accès
-- ---------------------------------------------------------------------
-- Réunion qu'on a le droit de voir : son professeur, ou un élève de sa classe
create or replace function public.meet_can_see(p_meeting uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and exists (
    select 1 from public.meetings m
    where m.id = p_meeting
      and (m.host_id = uid or (public.meet_module_on() and public.in_room(m.room_id, uid)))
  );
$$;
revoke execute on function public.meet_can_see(uuid, uuid) from public, anon;
grant execute on function public.meet_can_see(uuid, uuid) to authenticated;

-- Professeur de la classe, avec l'habilitation
create or replace function public.meet_can_host(p_room uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and public.meet_module_on()
    and exists (select 1 from public.rooms r where r.id = p_room and r.professor_id = uid)
    and public.has_permission('meet.host', uid);
$$;
revoke execute on function public.meet_can_host(uuid, uuid) from public, anon;
grant execute on function public.meet_can_host(uuid, uuid) to authenticated;

drop policy if exists "meet reunions lecture" on public.meetings;
create policy "meet reunions lecture" on public.meetings for select to authenticated
  using (host_id = auth.uid() or (status <> 'cancelled' and public.meet_module_on() and public.in_room(room_id, auth.uid())));

drop policy if exists "meet presence lecture" on public.meeting_attendance;
create policy "meet presence lecture" on public.meeting_attendance for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid()));

drop policy if exists "meet chat lecture" on public.meeting_messages;
create policy "meet chat lecture" on public.meeting_messages for select to authenticated
  using (public.meet_can_see(meeting_id));

-- Écrire : réunion en direct, pas exclu, chat ouvert (le professeur peut toujours écrire)
drop policy if exists "meet chat envoi" on public.meeting_messages;
create policy "meet chat envoi" on public.meeting_messages for insert to authenticated
  with check (
    sender_id = auth.uid() and deleted_at is null and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.status = 'live'
        and (m.host_id = auth.uid() or (
          public.meet_module_on() and public.in_room(m.room_id, auth.uid())
          and not (auth.uid() = any (m.kicked))
          and coalesce((m.settings ->> 'chat')::boolean, true)
        ))
    )
  );

grant select on public.meetings, public.meeting_attendance, public.meeting_messages to authenticated;
grant insert on public.meeting_messages to authenticated;

-- ---------------------------------------------------------------------
-- 3. Fonctions
-- ---------------------------------------------------------------------
-- Ferme les réunions abandonnées (professeur parti depuis 20 min) et les sorties non notées
create or replace function public.meet_expire()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.meeting_attendance a set left_at = a.last_seen_at
  where a.left_at is null and a.last_seen_at < now() - interval '3 minutes';
  update public.meetings m set status = 'ended', ended_at = coalesce(m.host_seen_at, now()), updated_at = now()
  where m.status = 'live' and coalesce(m.host_seen_at, m.started_at, m.created_at) < now() - interval '20 minutes';
  update public.meeting_attendance a set left_at = coalesce(a.left_at, least(a.last_seen_at, m.ended_at))
  from public.meetings m
  where a.meeting_id = m.id and m.status = 'ended' and a.left_at is null;
end;
$$;
revoke execute on function public.meet_expire() from public, anon, authenticated;

-- Prévient les élèves de la classe (cloche des notifications)
create or replace function public.meet_notify(m public.meetings, p_title text, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, title, message, type)
  select distinct s.id, p_title, p_message, 'info'
  from public.profiles s
  where s.role = 'student' and public.in_room(m.room_id, s.id);
end;
$$;
revoke execute on function public.meet_notify(public.meetings, text, text) from public, anon, authenticated;

-- Créer : p_start_now = true → réunion en direct tout de suite
create or replace function public.meet_create(
  p_room uuid, p_title text, p_start_now boolean default true, p_scheduled_at timestamptz default null,
  p_duration int default 60, p_description text default '', p_settings jsonb default null
) returns public.meetings language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); m public.meetings; v_room text;
begin
  perform public.meet_expire();
  if not public.meet_can_host(p_room, v_me) then
    raise exception 'Réunions non disponibles pour cette classe (meet.host)' using errcode = '42501';
  end if;
  if not coalesce(p_start_now, true) and p_scheduled_at is null then
    raise exception 'Choisissez la date de la réunion';
  end if;
  if coalesce(p_start_now, true) and exists (select 1 from public.meetings where room_id = p_room and status = 'live') then
    raise exception 'Une réunion est déjà en direct dans cette classe' using errcode = 'P0001';
  end if;
  if (select count(*) from public.meetings where host_id = v_me and created_at > now() - interval '10 minutes') >= 15 then
    raise exception 'Trop de réunions créées, patientez quelques minutes.';
  end if;
  select name into v_room from public.rooms where id = p_room;
  insert into public.meetings (room_id, host_id, title, description, status, scheduled_at, duration_min, started_at, host_seen_at, settings)
  values (
    p_room, v_me,
    coalesce(nullif(trim(p_title), ''), 'Réunion · ' || coalesce(v_room, '')),
    coalesce(p_description, ''),
    case when coalesce(p_start_now, true) then 'live' else 'scheduled' end,
    case when coalesce(p_start_now, true) then now() else p_scheduled_at end,
    greatest(5, least(600, coalesce(p_duration, 60))),
    case when coalesce(p_start_now, true) then now() end,
    case when coalesce(p_start_now, true) then now() end,
    '{"chat": true, "students_mic": true, "students_cam": true, "students_share": false, "locked": false}'::jsonb || coalesce(p_settings, '{}'::jsonb)
  ) returning * into m;
  if m.status = 'live' then
    perform public.meet_notify(m, 'Réunion en direct', m.title);
  else
    perform public.meet_notify(m, 'Réunion planifiée', m.title || ' · ' || to_char(m.scheduled_at at time zone 'Africa/Casablanca', 'DD/MM/YYYY HH24:MI'));
  end if;
  return m;
end;
$$;
revoke execute on function public.meet_create(uuid, text, boolean, timestamptz, int, text, jsonb) from public, anon;
grant execute on function public.meet_create(uuid, text, boolean, timestamptz, int, text, jsonb) to authenticated;

-- Modifier (titre, date, durée, description, réglages)
create or replace function public.meet_update(
  p_meeting uuid, p_title text default null, p_scheduled_at timestamptz default null,
  p_duration int default null, p_description text default null, p_settings jsonb default null
) returns public.meetings language plpgsql security definer set search_path = '' as $$
declare m public.meetings;
begin
  select * into m from public.meetings where id = p_meeting and host_id = auth.uid();
  if m.id is null then raise exception 'Réunion introuvable' using errcode = '42501'; end if;
  update public.meetings set
    title = coalesce(nullif(trim(p_title), ''), title),
    scheduled_at = case when status = 'scheduled' then coalesce(p_scheduled_at, scheduled_at) else scheduled_at end,
    duration_min = greatest(5, least(600, coalesce(p_duration, duration_min))),
    description = coalesce(p_description, description),
    settings = settings || coalesce(p_settings - 'kicked', '{}'::jsonb),
    updated_at = now()
  where id = p_meeting returning * into m;
  return m;
end;
$$;
revoke execute on function public.meet_update(uuid, text, timestamptz, int, text, jsonb) from public, anon;
grant execute on function public.meet_update(uuid, text, timestamptz, int, text, jsonb) to authenticated;

-- Démarrer une réunion planifiée
create or replace function public.meet_start(p_meeting uuid)
returns public.meetings language plpgsql security definer set search_path = '' as $$
declare m public.meetings;
begin
  perform public.meet_expire();
  select * into m from public.meetings where id = p_meeting and host_id = auth.uid();
  if m.id is null then raise exception 'Réunion introuvable' using errcode = '42501'; end if;
  if not public.meet_can_host(m.room_id) then raise exception 'Réunions non disponibles (meet.host)' using errcode = '42501'; end if;
  if m.status = 'live' then return m; end if;
  if m.status <> 'scheduled' then raise exception 'Cette réunion est terminée' using errcode = 'P0001'; end if;
  if exists (select 1 from public.meetings where room_id = m.room_id and status = 'live' and id <> m.id) then
    raise exception 'Une réunion est déjà en direct dans cette classe' using errcode = 'P0001';
  end if;
  update public.meetings set status = 'live', started_at = now(), host_seen_at = now(), updated_at = now()
  where id = p_meeting returning * into m;
  perform public.meet_notify(m, 'Réunion en direct', m.title);
  return m;
end;
$$;
revoke execute on function public.meet_start(uuid) from public, anon;
grant execute on function public.meet_start(uuid) to authenticated;

-- Terminer pour tout le monde
create or replace function public.meet_end(p_meeting uuid)
returns public.meetings language plpgsql security definer set search_path = '' as $$
declare m public.meetings;
begin
  update public.meetings set status = 'ended', ended_at = now(), updated_at = now()
  where id = p_meeting and host_id = auth.uid() and status = 'live' returning * into m;
  if m.id is null then
    select * into m from public.meetings where id = p_meeting and host_id = auth.uid();
    if m.id is null then raise exception 'Réunion introuvable' using errcode = '42501'; end if;
    return m;
  end if;
  update public.meeting_attendance set left_at = now() where meeting_id = p_meeting and left_at is null;
  return m;
end;
$$;
revoke execute on function public.meet_end(uuid) from public, anon;
grant execute on function public.meet_end(uuid) to authenticated;

-- Annuler une réunion planifiée (les élèves sont prévenus)
create or replace function public.meet_cancel(p_meeting uuid)
returns public.meetings language plpgsql security definer set search_path = '' as $$
declare m public.meetings;
begin
  update public.meetings set status = 'cancelled', updated_at = now()
  where id = p_meeting and host_id = auth.uid() and status = 'scheduled' returning * into m;
  if m.id is null then raise exception 'Réunion introuvable ou déjà commencée' using errcode = 'P0001'; end if;
  perform public.meet_notify(m, 'Réunion annulée', m.title);
  return m;
end;
$$;
revoke execute on function public.meet_cancel(uuid) from public, anon;
grant execute on function public.meet_cancel(uuid) to authenticated;

-- Supprimer (réunion terminée ou annulée, avec son chat et sa présence)
create or replace function public.meet_delete(p_meeting uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.meetings where id = p_meeting and host_id = auth.uid() and status in ('ended', 'cancelled');
  if not found then raise exception 'Seule une réunion terminée ou annulée peut être supprimée' using errcode = 'P0001'; end if;
end;
$$;
revoke execute on function public.meet_delete(uuid) from public, anon;
grant execute on function public.meet_delete(uuid) to authenticated;

-- Entrer dans la réunion : vérifie tout, note la présence, renvoie ce qu'il faut au jeton LiveKit.
-- Le professeur qui entre dans une réunion planifiée la démarre.
create or replace function public.meet_join(p_meeting uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); m public.meetings; v_host boolean; p public.profiles; v_room text; v_host_name text;
begin
  if v_me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  perform public.meet_expire();
  select * into m from public.meetings where id = p_meeting;
  if m.id is null or not public.meet_can_see(p_meeting, v_me) then
    raise exception 'Réunion introuvable ou réservée aux élèves de la classe' using errcode = '42501';
  end if;
  v_host := m.host_id = v_me;
  if v_host then
    if m.status = 'scheduled' then m := public.meet_start(p_meeting); end if;
    if not public.meet_can_host(m.room_id, v_me) then raise exception 'Réunions non disponibles (meet.host)' using errcode = '42501'; end if;
  else
    if not public.has_permission('meet.host', m.host_id) then
      raise exception 'Réunions non incluses dans l''offre du professeur' using errcode = '42501';
    end if;
    if v_me = any (m.kicked) then raise exception 'Le professeur vous a retiré de cette réunion' using errcode = '42501'; end if;
  end if;
  if m.status = 'scheduled' then raise exception 'La réunion n''a pas encore commencé' using errcode = 'P0001'; end if;
  if m.status <> 'live' then raise exception 'Cette réunion est terminée' using errcode = 'P0001'; end if;
  if not v_host and coalesce((m.settings ->> 'locked')::boolean, false)
     and not exists (select 1 from public.meeting_attendance where meeting_id = p_meeting and user_id = v_me) then
    raise exception 'Le professeur a verrouillé la réunion' using errcode = 'P0001';
  end if;

  update public.meeting_attendance set left_at = last_seen_at where meeting_id = p_meeting and user_id = v_me and left_at is null;
  insert into public.meeting_attendance (meeting_id, user_id) values (p_meeting, v_me);
  if v_host then update public.meetings set host_seen_at = now() where id = p_meeting; end if;

  select * into p from public.profiles where id = v_me;
  select name into v_room from public.rooms where id = m.room_id;
  select name into v_host_name from public.profiles where id = m.host_id;
  return jsonb_build_object(
    'meeting', to_jsonb(m) - 'kicked',
    'role', case when v_host then 'host' else 'student' end,
    'user_id', v_me,
    'name', coalesce(nullif(p.name, ''), 'Utilisateur'),
    'avatar_url', p.avatar_url,
    'room_name', v_room,
    'host_name', v_host_name
  );
end;
$$;
revoke execute on function public.meet_join(uuid) from public, anon;
grant execute on function public.meet_join(uuid) to authenticated;

-- Toujours là (toutes les 45 s) ; renvoie l'état de la réunion
create or replace function public.meet_heartbeat(p_meeting uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_status text;
begin
  update public.meeting_attendance set last_seen_at = now()
  where id = (select id from public.meeting_attendance where meeting_id = p_meeting and user_id = v_me and left_at is null order by joined_at desc limit 1);
  if not found then
    -- revenu après une coupure : nouvelle entrée si la réunion est toujours en direct
    if exists (select 1 from public.meetings where id = p_meeting and status = 'live' and public.meet_can_see(p_meeting, v_me) and not (v_me = any (kicked))) then
      insert into public.meeting_attendance (meeting_id, user_id) values (p_meeting, v_me);
    end if;
  end if;
  update public.meetings set host_seen_at = now() where id = p_meeting and host_id = v_me and status = 'live';
  select status into v_status from public.meetings where id = p_meeting;
  return v_status;
end;
$$;
revoke execute on function public.meet_heartbeat(uuid) from public, anon;
grant execute on function public.meet_heartbeat(uuid) to authenticated;

create or replace function public.meet_leave(p_meeting uuid)
returns void language sql security definer set search_path = '' as $$
  update public.meeting_attendance set left_at = now(), last_seen_at = now()
  where meeting_id = p_meeting and user_id = auth.uid() and left_at is null;
$$;
revoke execute on function public.meet_leave(uuid) from public, anon;
grant execute on function public.meet_leave(uuid) to authenticated;

-- Retirer un élève (il ne peut plus revenir) ; p_allow = true le réautorise
create or replace function public.meet_kick(p_meeting uuid, p_user uuid, p_allow boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.meetings set
    kicked = case when coalesce(p_allow, false) then array_remove(kicked, p_user)
                  else array_append(array_remove(kicked, p_user), p_user) end,
    updated_at = now()
  where id = p_meeting and host_id = auth.uid() and p_user <> host_id;
  if not found then raise exception 'Réunion introuvable' using errcode = '42501'; end if;
  if not coalesce(p_allow, false) then
    update public.meeting_attendance set left_at = now() where meeting_id = p_meeting and user_id = p_user and left_at is null;
  end if;
end;
$$;
revoke execute on function public.meet_kick(uuid, uuid, boolean) from public, anon;
grant execute on function public.meet_kick(uuid, uuid, boolean) to authenticated;

-- Supprimer un message du chat (son auteur ou le professeur)
create or replace function public.meet_delete_message(p_message uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.meeting_messages mm set deleted_at = now(), body = '·'
  where mm.id = p_message and mm.deleted_at is null
    and (mm.sender_id = auth.uid() or exists (select 1 from public.meetings m where m.id = mm.meeting_id and m.host_id = auth.uid()));
end;
$$;
revoke execute on function public.meet_delete_message(uuid) from public, anon;
grant execute on function public.meet_delete_message(uuid) to authenticated;

-- Rapport de présence : tous les élèves de la classe, présents ou absents
create or replace function public.meet_report(p_meeting uuid)
returns table (user_id uuid, name text, avatar_url text, role text, first_join timestamptz, last_leave timestamptz, seconds int, sessions int)
language plpgsql stable security definer set search_path = '' as $$
declare m public.meetings;
begin
  select * into m from public.meetings where id = p_meeting and host_id = auth.uid();
  if m.id is null then return; end if;
  return query
  with people as (
    select s.id from public.profiles s where s.role = 'student' and public.in_room(m.room_id, s.id)
    union
    select a.user_id from public.meeting_attendance a where a.meeting_id = p_meeting
  ), att as (
    select a.user_id as uid, min(a.joined_at) as first_join, max(coalesce(a.left_at, a.last_seen_at)) as last_leave,
      sum(greatest(0, extract(epoch from (coalesce(a.left_at, case when m.status = 'live' then now() else a.last_seen_at end) - a.joined_at))))::int as seconds,
      count(*)::int as sessions
    from public.meeting_attendance a where a.meeting_id = p_meeting group by a.user_id
  )
  select p.id, coalesce(pr.name, '')::text, pr.avatar_url::text,
         case when p.id = m.host_id then 'host' else 'student' end::text,
         att.first_join, att.last_leave, coalesce(att.seconds, 0), coalesce(att.sessions, 0)
  from people p
  join public.profiles pr on pr.id = p.id
  left join att on att.uid = p.id
  order by (p.id = m.host_id) desc, coalesce(att.seconds, 0) desc, pr.name;
end;
$$;
revoke execute on function public.meet_report(uuid) from public, anon;
grant execute on function public.meet_report(uuid) to authenticated;

-- Liste des réunions (d'une classe, ou de toutes ses classes) avec le nombre de présents
create or replace function public.meet_list(p_room uuid default null)
returns table (
  id uuid, room_id uuid, room_name text, host_id uuid, host_name text, title text, description text, status text,
  scheduled_at timestamptz, duration_min int, started_at timestamptz, ended_at timestamptz, settings jsonb,
  attendees int, online int, messages int, my_seconds int
) language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then return; end if;
  perform public.meet_expire();
  return query
  select m.id, m.room_id, r.name::text, m.host_id, coalesce(hp.name, '')::text, m.title, m.description, m.status,
         m.scheduled_at, m.duration_min, m.started_at, m.ended_at, m.settings,
         (select count(distinct a.user_id)::int from public.meeting_attendance a where a.meeting_id = m.id and a.user_id <> m.host_id),
         (select count(distinct a.user_id)::int from public.meeting_attendance a where a.meeting_id = m.id and a.left_at is null and a.last_seen_at > now() - interval '2 minutes'),
         (select count(*)::int from public.meeting_messages mm where mm.meeting_id = m.id and mm.deleted_at is null),
         (select coalesce(sum(greatest(0, extract(epoch from (coalesce(a.left_at, a.last_seen_at) - a.joined_at)))), 0)::int
            from public.meeting_attendance a where a.meeting_id = m.id and a.user_id = v_me)
  from public.meetings m
  join public.rooms r on r.id = m.room_id
  left join public.profiles hp on hp.id = m.host_id
  where (p_room is null or m.room_id = p_room)
    and (m.host_id = v_me or (m.status <> 'cancelled' and public.meet_module_on() and public.in_room(m.room_id, v_me)))
  order by (m.status = 'live') desc, (m.status = 'scheduled') desc,
           case when m.status = 'scheduled' then m.scheduled_at end asc,
           coalesce(m.started_at, m.scheduled_at, m.created_at) desc
  limit 200;
end;
$$;
revoke execute on function public.meet_list(uuid) from public, anon;
grant execute on function public.meet_list(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Temps réel (bandeau « réunion en direct », chat)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['meetings', 'meeting_messages'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    when undefined_object then raise notice 'publication supabase_realtime absente';
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
insert into public.applied_migrations (name) values ('20261116090000_class_meetings') on conflict do nothing;
