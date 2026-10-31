-- Chat élèves ↔ profs : appels vidéo + messages par classe
-- À lancer après 20261114090000_student_teacher_chat.sql. Sans risque à relancer.

-- 1. Appels vidéo
alter table public.chat_calls add column if not exists video boolean not null default false;

create or replace function public.chat_call_log(c public.chat_calls)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_messages (conversation_id, sender_id, kind, body, meta)
  values (c.conversation_id, c.caller_id, 'call', '', jsonb_build_object(
    'call_id', c.id, 'status', c.status, 'video', coalesce(c.video, false),
    'duration', case when c.answered_at is not null then greatest(0, extract(epoch from (coalesce(c.ended_at, now()) - c.answered_at))::int) else 0 end
  ));
  if c.status in ('missed', 'cancelled') then
    insert into public.notifications (user_id, title, message, type)
    values (c.callee_id, case when coalesce(c.video, false) then 'Appel vidéo manqué' else 'Appel manqué' end, coalesce((select name from public.profiles where id = c.caller_id), ''), 'info');
  end if;
end;
$$;
revoke execute on function public.chat_call_log(public.chat_calls) from public, anon, authenticated;

drop function if exists public.chat_call_start(uuid);
create or replace function public.chat_call_start(p_conv uuid, p_video boolean default false)
returns public.chat_calls language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); cv public.chat_conversations; v_other uuid; c public.chat_calls;
begin
  perform public.chat_calls_expire();
  select * into cv from public.chat_conversations where id = p_conv and (teacher_id = v_me or student_id = v_me);
  if cv.id is null then raise exception 'Discussion introuvable' using errcode = '42501'; end if;
  if not public.chat_can_send(p_conv) then raise exception 'Vous ne pouvez pas appeler dans cette discussion' using errcode = '42501'; end if;
  if not public.has_permission('chat.calls', cv.teacher_id) then
    raise exception 'Appels non inclus dans l''offre du professeur (chat.calls)' using errcode = '42501';
  end if;
  v_other := case when cv.teacher_id = v_me then cv.student_id else cv.teacher_id end;
  -- Un élève n'appelle pas un professeur qui a coupé les appels
  if v_other = cv.teacher_id and not coalesce((select allow_calls from public.chat_settings where user_id = v_other), true) then
    raise exception 'Ce professeur ne reçoit pas d''appels pour le moment' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.chat_calls where status in ('ringing', 'accepted') and (caller_id in (v_me, v_other) or callee_id in (v_me, v_other))) then
    raise exception 'Occupé : un appel est déjà en cours' using errcode = 'P0001';
  end if;
  if (select count(*) from public.chat_calls where caller_id = v_me and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Trop d''appels, patientez quelques minutes.';
  end if;
  insert into public.chat_calls (conversation_id, caller_id, callee_id, video) values (p_conv, v_me, v_other, coalesce(p_video, false)) returning * into c;
  return c;
end;
$$;
revoke execute on function public.chat_call_start(uuid, boolean) from public, anon;
grant execute on function public.chat_call_start(uuid, boolean) to authenticated;

-- 2. Messages par classe : chat_contacts renvoie aussi les identifiants des classes (room_ids)
drop function if exists public.chat_contacts();
create or replace function public.chat_contacts()
returns table (
  user_id uuid, name text, avatar_url text, role text, room_names text,
  conversation_id uuid, last_message_at timestamptz, last_message_preview text, last_sender_id uuid,
  unread int, other_read_at timestamptz, muted boolean, closed boolean,
  can_chat boolean, can_call boolean, last_seen_at timestamptz, room_ids uuid[]
)
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_role text;
begin
  if v_me is null then return; end if;
  select p.role into v_role from public.profiles p where p.id = v_me;
  if not public.chat_module_on() then return; end if;

  if v_role = 'student' then
    return query
    with t as (
      select r.professor_id as tid, string_agg(distinct r.name, ' · ') as rooms, array_agg(distinct r.id) as rids
      from public.rooms r
      where r.id = (select room_id from public.profiles where id = v_me)
         or r.id in (select e.room_id from public.enrollments e where e.student_id = v_me and e.room_id is not null)
      group by r.professor_id
    )
    select t.tid, coalesce(p.name, 'Professeur')::text, p.avatar_url::text, 'professor'::text, t.rooms::text,
           c.id, c.last_message_at, c.last_message_preview, c.last_sender_id,
           (select count(*)::int from public.chat_messages m where m.conversation_id = c.id and m.sender_id <> v_me
              and m.created_at > coalesce(c.student_read_at, '-infinity'::timestamptz)),
           c.teacher_read_at, coalesce(c.student_muted, false), coalesce(c.closed_by_teacher, false),
           public.has_permission('chat.students', t.tid),
           public.has_permission('chat.calls', t.tid) and coalesce(s.allow_calls, true),
           s.last_seen_at, t.rids
    from t
    join public.profiles p on p.id = t.tid
    left join public.chat_conversations c on c.teacher_id = t.tid and c.student_id = v_me
    left join public.chat_settings s on s.user_id = t.tid
    where public.has_permission('chat.students', t.tid) or c.id is not null;
  else
    return query
    with st as (
      select s.id as sid, string_agg(distinct r.name, ' · ') as rooms, array_agg(distinct r.id) as rids
      from public.rooms r
      join public.profiles s on s.role = 'student' and (
        s.room_id = r.id or exists (select 1 from public.enrollments e where e.room_id = r.id and e.student_id = s.id))
      where r.professor_id = v_me and r.archived_at is null
      group by s.id
    ), allc as (
      select sid, rooms, rids from st
      union
      select c.student_id, null, null::uuid[] from public.chat_conversations c where c.teacher_id = v_me
        and not exists (select 1 from st where st.sid = c.student_id)
    )
    select a.sid, coalesce(p.name, 'Élève')::text, p.avatar_url::text, 'student'::text, a.rooms::text,
           c.id, c.last_message_at, c.last_message_preview, c.last_sender_id,
           (select count(*)::int from public.chat_messages m where m.conversation_id = c.id and m.sender_id <> v_me
              and m.created_at > coalesce(c.teacher_read_at, '-infinity'::timestamptz)),
           c.student_read_at, coalesce(c.teacher_muted, false), coalesce(c.closed_by_teacher, false),
           public.has_permission('chat.students', v_me) and a.rooms is not null,
           public.has_permission('chat.calls', v_me) and a.rooms is not null,
           s.last_seen_at, a.rids
    from allc a
    join public.profiles p on p.id = a.sid
    left join public.chat_conversations c on c.teacher_id = v_me and c.student_id = a.sid
    left join public.chat_settings s on s.user_id = a.sid;
  end if;
end;
$$;
revoke execute on function public.chat_contacts() from public, anon;
grant execute on function public.chat_contacts() to authenticated;

notify pgrst, 'reload schema';
insert into public.applied_migrations (name) values ('20261115090000_chat_video_classes') on conflict do nothing;
