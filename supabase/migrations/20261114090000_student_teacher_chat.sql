-- =====================================================================
-- Messagerie élève ↔ professeur + appels vocaux
--   • une discussion par couple (professeur, élève) : jamais entre élèves
--   • le lien est vérifié dans la base : l'élève est dans une classe du professeur
--     (profiles.room_id ou inscription), sinon rien ne passe (RLS + fonctions)
--   • messages : texte, photos, vidéos, documents, vocal, contact, position,
--     réponses, réactions, suppression pour tous, accusés de lecture
--   • appels vocaux WebRTC : journal des appels + signalisation Realtime privée
--   • fichiers : bucket privé « chat-media », dossier = id de la discussion
--   • habilitations : chat.students (messagerie) et chat.calls (appels)
-- À lancer après 20261112100000_copy_fix_dates.sql. Relançable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Habilitations (catalogue + offres existantes)
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
  ('chat.students', 'chat', 'Messagerie avec mes élèves (texte, photos, vidéos, documents, vocal)', 'المراسلة مع تلاميذي (نص، صور، فيديو، وثائق، صوت)', 'Messaging with my students (text, photos, videos, documents, voice)', 'feature', true, 640),
  ('chat.calls',    'chat', 'Appels vocaux avec mes élèves', 'المكالمات الصوتية مع تلاميذي', 'Voice calls with my students', 'feature', true, 641)
on conflict (key) do update set module = excluded.module, label_fr = excluded.label_fr, label_ar = excluded.label_ar,
  label_en = excluded.label_en, is_write = excluded.is_write, sort_order = excluded.sort_order;

insert into public.plan_permissions (plan_id, permission_key, limit_value)
select p.id, k.key, null from public.plans p
cross join (values ('chat.students'), ('chat.calls')) as k(key)
on conflict (plan_id, permission_key) do nothing;

-- ---------------------------------------------------------------------
-- 1. Lien professeur ↔ élève (seule règle d'accès)
-- ---------------------------------------------------------------------
create or replace function public.chat_is_teacher_of(p_teacher uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_teacher is not null and p_student is not null and p_teacher <> p_student and (
    exists (
      select 1 from public.profiles s join public.rooms r on r.id = s.room_id
      where s.id = p_student and s.role = 'student' and r.professor_id = p_teacher
    )
    or exists (
      select 1 from public.enrollments e
      join public.rooms r on r.id = e.room_id
      join public.profiles s on s.id = e.student_id and s.role = 'student'
      where e.student_id = p_student and r.professor_id = p_teacher
    )
  );
$$;
revoke execute on function public.chat_is_teacher_of(uuid, uuid) from public, anon;
grant execute on function public.chat_is_teacher_of(uuid, uuid) to authenticated;

-- Module allumé par l'administration (Personnalisation → Modules)
create or replace function public.chat_module_on()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (a.data -> 'features' ->> 'chat')::boolean from public.app_settings a where a.id = 1), true);
$$;
revoke execute on function public.chat_module_on() from public, anon;
grant execute on function public.chat_module_on() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------
create table if not exists public.chat_conversations (
  id                   uuid primary key default gen_random_uuid(),
  teacher_id           uuid not null references auth.users(id) on delete cascade,
  student_id           uuid not null references auth.users(id) on delete cascade,
  created_at           timestamptz not null default now(),
  last_message_at      timestamptz,
  last_message_preview text,
  last_sender_id       uuid,
  teacher_read_at      timestamptz,
  student_read_at      timestamptz,
  teacher_muted        boolean not null default false,
  student_muted        boolean not null default false,
  -- Le professeur peut fermer la discussion : l'élève lit mais n'écrit plus
  closed_by_teacher    boolean not null default false,
  unique (teacher_id, student_id),
  check (teacher_id <> student_id)
);
create index if not exists idx_chat_conv_teacher on public.chat_conversations (teacher_id, last_message_at desc nulls last);
create index if not exists idx_chat_conv_student on public.chat_conversations (student_id, last_message_at desc nulls last);

create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id       uuid not null default auth.uid(),
  kind            text not null default 'text' check (kind in ('text', 'media', 'voice', 'file', 'contact', 'location', 'call')),
  body            text not null default '' check (char_length(body) <= 5000),
  attachments     jsonb not null default '[]'::jsonb,
  location        jsonb,
  contact         jsonb,
  meta            jsonb,
  reply_to        uuid references public.chat_messages(id) on delete set null,
  client_id       text,
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz
);
create index if not exists idx_chat_msg_conv on public.chat_messages (conversation_id, created_at desc);
create unique index if not exists idx_chat_msg_client on public.chat_messages (conversation_id, client_id) where client_id is not null;

create table if not exists public.chat_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.chat_calls (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  caller_id       uuid not null,
  callee_id       uuid not null,
  status          text not null default 'ringing' check (status in ('ringing', 'accepted', 'declined', 'missed', 'cancelled', 'ended', 'failed')),
  created_at      timestamptz not null default now(),
  answered_at     timestamptz,
  ended_at        timestamptz
);
create index if not exists idx_chat_calls_callee on public.chat_calls (callee_id, status, created_at desc);
create index if not exists idx_chat_calls_conv on public.chat_calls (conversation_id, created_at desc);

-- Réglages personnels : appels acceptés, dernière présence
create table if not exists public.chat_settings (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  allow_calls  boolean not null default true,
  last_seen_at timestamptz,
  updated_at   timestamptz not null default now()
);

-- Le client a seulement le droit de lire ; tout passe par les fonctions ci-dessous
-- ou par des règles très étroites.
alter table public.chat_conversations enable row level security;
alter table public.chat_messages      enable row level security;
alter table public.chat_reactions     enable row level security;
alter table public.chat_calls         enable row level security;
alter table public.chat_settings      enable row level security;
revoke all on public.chat_conversations, public.chat_messages, public.chat_reactions, public.chat_calls, public.chat_settings from anon;
grant select on public.chat_conversations, public.chat_calls to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert, update, delete on public.chat_reactions to authenticated;
grant select on public.chat_settings to authenticated;

-- Membre d'une discussion (accepte un texte : sert aussi aux dossiers et canaux)
create or replace function public.chat_is_member(p_conv text, uid uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  begin v := p_conv::uuid; exception when others then return false; end;
  return uid is not null and exists (
    select 1 from public.chat_conversations c where c.id = v and (c.teacher_id = uid or c.student_id = uid)
  );
end;
$$;
revoke execute on function public.chat_is_member(text, uuid) from public, anon;
grant execute on function public.chat_is_member(text, uuid) to authenticated;

-- Peut écrire maintenant : membre, lien toujours valide, module + offre du professeur,
-- discussion non fermée (pour l'élève)
create or replace function public.chat_can_send(p_conv uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and public.chat_module_on() and exists (
    select 1 from public.chat_conversations c
    where c.id = p_conv and (c.teacher_id = uid or c.student_id = uid)
      and public.chat_is_teacher_of(c.teacher_id, c.student_id)
      and public.has_permission('chat.students', c.teacher_id)
      and (uid = c.teacher_id or not c.closed_by_teacher)
  );
$$;
revoke execute on function public.chat_can_send(uuid, uuid) from public, anon;
grant execute on function public.chat_can_send(uuid, uuid) to authenticated;

drop policy if exists "chat discussions lecture" on public.chat_conversations;
create policy "chat discussions lecture" on public.chat_conversations for select to authenticated
  using (teacher_id = (select auth.uid()) or student_id = (select auth.uid()));

drop policy if exists "chat messages lecture" on public.chat_messages;
create policy "chat messages lecture" on public.chat_messages for select to authenticated
  using (public.chat_is_member(conversation_id::text));
drop policy if exists "chat messages envoi" on public.chat_messages;
create policy "chat messages envoi" on public.chat_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and kind <> 'call' and meta is null and deleted_at is null and edited_at is null
    and public.chat_can_send(conversation_id)
  );

drop policy if exists "chat reactions lecture" on public.chat_reactions;
create policy "chat reactions lecture" on public.chat_reactions for select to authenticated
  using (exists (select 1 from public.chat_messages m where m.id = message_id and public.chat_is_member(m.conversation_id::text)));
drop policy if exists "chat reactions ecriture" on public.chat_reactions;
create policy "chat reactions ecriture" on public.chat_reactions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.chat_messages m where m.id = message_id and m.deleted_at is null and public.chat_can_send(m.conversation_id)));

drop policy if exists "chat appels lecture" on public.chat_calls;
create policy "chat appels lecture" on public.chat_calls for select to authenticated
  using (caller_id = (select auth.uid()) or callee_id = (select auth.uid()));

-- Réglages : chacun lit les siens ; le reste passe par chat_contacts()
drop policy if exists "chat reglages lecture" on public.chat_settings;
create policy "chat reglages lecture" on public.chat_settings for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 3. Après un message : aperçu, lu par l'expéditeur, contrôles
-- ---------------------------------------------------------------------
create or replace function public.chat_preview(p_kind text, p_body text, p_att jsonb)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_kind = 'voice' then '🎤 Message vocal'
    when p_kind = 'location' then '📍 Position'
    when p_kind = 'contact' then '👤 Contact'
    when p_kind = 'call' then '📞 Appel'
    when coalesce(trim(p_body), '') <> '' then left(trim(p_body), 160)
    when jsonb_array_length(coalesce(p_att, '[]'::jsonb)) > 0 then
      case
        when (p_att -> 0 ->> 'type') like 'image/%' then '📷 Photo'
        when (p_att -> 0 ->> 'type') like 'video/%' then '🎬 Vidéo'
        when (p_att -> 0 ->> 'type') like 'audio/%' then '🎵 Audio'
        else '📎 ' || left(coalesce(p_att -> 0 ->> 'name', 'Document'), 120)
      end
    else '' end;
$$;

create or replace function public.chat_message_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    if jsonb_typeof(coalesce(new.attachments, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(new.attachments, '[]'::jsonb)) > 10 then
      raise exception 'Pièces jointes invalides';
    end if;
    -- Pièces jointes : seulement dans le dossier de la discussion
    if exists (select 1 from jsonb_array_elements(coalesce(new.attachments, '[]'::jsonb)) a
               where coalesce(a ->> 'path', '') not like new.conversation_id::text || '/%') then
      raise exception 'Pièce jointe hors de la discussion';
    end if;
    if new.kind <> 'call' and coalesce(trim(new.body), '') = '' and jsonb_array_length(coalesce(new.attachments, '[]'::jsonb)) = 0
       and new.location is null and new.contact is null then
      raise exception 'Message vide';
    end if;
    if new.reply_to is not null and not exists (select 1 from public.chat_messages r where r.id = new.reply_to and r.conversation_id = new.conversation_id) then
      new.reply_to := null;
    end if;
    -- Anti-abus : 30 messages par minute au plus
    if new.kind <> 'call' and (select count(*) from public.chat_messages m
        where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute') >= 30 then
      raise exception 'Trop de messages, patientez un instant.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists chat_message_before on public.chat_messages;
create trigger chat_message_before before insert on public.chat_messages
  for each row execute function public.chat_message_before();

create or replace function public.chat_message_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c public.chat_conversations;
begin
  select * into c from public.chat_conversations where id = new.conversation_id;
  update public.chat_conversations set
    last_message_at = new.created_at,
    last_message_preview = public.chat_preview(new.kind, new.body, new.attachments),
    last_sender_id = new.sender_id,
    teacher_read_at = case when new.sender_id = c.teacher_id then new.created_at else teacher_read_at end,
    student_read_at = case when new.sender_id = c.student_id then new.created_at else student_read_at end
  where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists chat_message_after on public.chat_messages;
create trigger chat_message_after after insert on public.chat_messages
  for each row execute function public.chat_message_after();

-- ---------------------------------------------------------------------
-- 4. Fonctions appelées par l'application
-- ---------------------------------------------------------------------
-- Mes contacts : professeurs (élève) ou élèves de mes classes (professeur),
-- avec la discussion existante, les non-lus et la présence.
create or replace function public.chat_contacts()
returns table (
  user_id uuid, name text, avatar_url text, role text, room_names text,
  conversation_id uuid, last_message_at timestamptz, last_message_preview text, last_sender_id uuid,
  unread int, other_read_at timestamptz, muted boolean, closed boolean,
  can_chat boolean, can_call boolean, last_seen_at timestamptz
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
      select r.professor_id as tid, string_agg(distinct r.name, ' · ') as rooms
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
           s.last_seen_at
    from t
    join public.profiles p on p.id = t.tid
    left join public.chat_conversations c on c.teacher_id = t.tid and c.student_id = v_me
    left join public.chat_settings s on s.user_id = t.tid
    where public.has_permission('chat.students', t.tid) or c.id is not null;
  else
    return query
    with st as (
      select s.id as sid, string_agg(distinct r.name, ' · ') as rooms
      from public.rooms r
      join public.profiles s on s.role = 'student' and (
        s.room_id = r.id or exists (select 1 from public.enrollments e where e.room_id = r.id and e.student_id = s.id))
      where r.professor_id = v_me and r.archived_at is null
      group by s.id
    ), allc as (
      select sid, rooms from st
      union
      select c.student_id, null from public.chat_conversations c where c.teacher_id = v_me
        and not exists (select 1 from st where st.sid = c.student_id)
    )
    select a.sid, coalesce(p.name, 'Élève')::text, p.avatar_url::text, 'student'::text, a.rooms::text,
           c.id, c.last_message_at, c.last_message_preview, c.last_sender_id,
           (select count(*)::int from public.chat_messages m where m.conversation_id = c.id and m.sender_id <> v_me
              and m.created_at > coalesce(c.teacher_read_at, '-infinity'::timestamptz)),
           c.student_read_at, coalesce(c.teacher_muted, false), coalesce(c.closed_by_teacher, false),
           public.has_permission('chat.students', v_me) and a.rooms is not null,
           public.has_permission('chat.calls', v_me) and a.rooms is not null,
           s.last_seen_at
    from allc a
    join public.profiles p on p.id = a.sid
    left join public.chat_conversations c on c.teacher_id = v_me and c.student_id = a.sid
    left join public.chat_settings s on s.user_id = a.sid;
  end if;
end;
$$;
revoke execute on function public.chat_contacts() from public, anon;
grant execute on function public.chat_contacts() to authenticated;

-- Ouvrir (ou créer) la discussion avec un contact autorisé
create or replace function public.chat_open(p_other uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_teacher uuid; v_student uuid; v_id uuid;
begin
  if v_me is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if not public.chat_module_on() then raise exception 'Messagerie désactivée'; end if;
  if public.chat_is_teacher_of(v_me, p_other) then v_teacher := v_me; v_student := p_other;
  elsif public.chat_is_teacher_of(p_other, v_me) then v_teacher := p_other; v_student := v_me;
  else
    -- Discussion déjà existante (élève changé de classe) : lecture seule
    select id into v_id from public.chat_conversations
    where (teacher_id = v_me and student_id = p_other) or (teacher_id = p_other and student_id = v_me);
    if v_id is not null then return v_id; end if;
    raise exception 'Vous ne pouvez écrire qu''à vos professeurs ou à vos élèves' using errcode = '42501';
  end if;
  if not public.has_permission('chat.students', v_teacher) then
    raise exception 'Fonction non incluse dans l''offre du professeur (chat.students)' using errcode = '42501';
  end if;
  insert into public.chat_conversations (teacher_id, student_id) values (v_teacher, v_student)
  on conflict (teacher_id, student_id) do nothing;
  select id into v_id from public.chat_conversations where teacher_id = v_teacher and student_id = v_student;
  return v_id;
end;
$$;
revoke execute on function public.chat_open(uuid) from public, anon;
grant execute on function public.chat_open(uuid) to authenticated;

create or replace function public.chat_mark_read(p_conv uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.chat_conversations set teacher_read_at = now() where id = p_conv and teacher_id = auth.uid();
  update public.chat_conversations set student_read_at = now() where id = p_conv and student_id = auth.uid();
end;
$$;
revoke execute on function public.chat_mark_read(uuid) from public, anon;
grant execute on function public.chat_mark_read(uuid) to authenticated;

-- Sourdine (chacun pour soi) et fermeture (professeur)
create or replace function public.chat_set_flags(p_conv uuid, p_muted boolean default null, p_closed boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.chat_conversations set
    teacher_muted = coalesce(p_muted, teacher_muted),
    closed_by_teacher = coalesce(p_closed, closed_by_teacher)
  where id = p_conv and teacher_id = auth.uid();
  update public.chat_conversations set student_muted = coalesce(p_muted, student_muted)
  where id = p_conv and student_id = auth.uid();
end;
$$;
revoke execute on function public.chat_set_flags(uuid, boolean, boolean) from public, anon;
grant execute on function public.chat_set_flags(uuid, boolean, boolean) to authenticated;

-- Supprimer un de mes messages pour tout le monde (le fichier aussi)
create or replace function public.chat_delete_message(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.chat_messages;
begin
  select * into m from public.chat_messages where id = p_id and sender_id = auth.uid() and kind <> 'call';
  if m.id is null then raise exception 'Message introuvable' using errcode = '42501'; end if;
  -- Les fichiers sont retirés du stockage par l'application (règle « chat media suppression »)
  delete from public.chat_reactions where message_id = p_id;
  update public.chat_messages set deleted_at = now(), body = '', attachments = '[]'::jsonb, location = null, contact = null
  where id = p_id;
  update public.chat_conversations c set last_message_preview = '🚫 Message supprimé'
  where c.id = m.conversation_id and c.last_message_at = m.created_at;
end;
$$;
revoke execute on function public.chat_delete_message(uuid) from public, anon;
grant execute on function public.chat_delete_message(uuid) to authenticated;

-- Modifier le texte d'un de mes messages (15 minutes au plus)
create or replace function public.chat_edit_message(p_id uuid, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if char_length(coalesce(trim(p_body), '')) = 0 then raise exception 'Message vide'; end if;
  update public.chat_messages set body = left(trim(p_body), 5000), edited_at = now()
  where id = p_id and sender_id = auth.uid() and kind = 'text' and deleted_at is null
    and created_at > now() - interval '15 minutes' and public.chat_can_send(conversation_id);
  if not found then raise exception 'Ce message ne peut plus être modifié'; end if;
end;
$$;
revoke execute on function public.chat_edit_message(uuid, text) from public, anon;
grant execute on function public.chat_edit_message(uuid, text) to authenticated;

-- Présence (« en ligne », « vu à ») et appels acceptés
create or replace function public.chat_heartbeat()
returns void language sql security definer set search_path = '' as $$
  insert into public.chat_settings (user_id, last_seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set last_seen_at = now();
$$;
revoke execute on function public.chat_heartbeat() from public, anon;
grant execute on function public.chat_heartbeat() to authenticated;

create or replace function public.chat_set_allow_calls(p_allow boolean)
returns void language sql security definer set search_path = '' as $$
  insert into public.chat_settings (user_id, allow_calls) values (auth.uid(), p_allow)
  on conflict (user_id) do update set allow_calls = excluded.allow_calls, updated_at = now();
$$;
revoke execute on function public.chat_set_allow_calls(boolean) from public, anon;
grant execute on function public.chat_set_allow_calls(boolean) to authenticated;

create or replace function public.chat_unread_count()
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum((
    select count(*) from public.chat_messages m
    where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.deleted_at is null
      and m.created_at > coalesce(case when c.teacher_id = auth.uid() then c.teacher_read_at else c.student_read_at end, '-infinity'::timestamptz)
  )), 0)::int
  from public.chat_conversations c
  where (c.teacher_id = auth.uid() and not c.teacher_muted) or (c.student_id = auth.uid() and not c.student_muted);
$$;
revoke execute on function public.chat_unread_count() from public, anon;
grant execute on function public.chat_unread_count() to authenticated;

-- ---------------------------------------------------------------------
-- 5. Appels vocaux
-- ---------------------------------------------------------------------
-- Ligne « appel » dans la discussion quand l'appel se termine
create or replace function public.chat_call_log(c public.chat_calls)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_messages (conversation_id, sender_id, kind, body, meta)
  values (c.conversation_id, c.caller_id, 'call', '', jsonb_build_object(
    'call_id', c.id, 'status', c.status,
    'duration', case when c.answered_at is not null then greatest(0, extract(epoch from (coalesce(c.ended_at, now()) - c.answered_at))::int) else 0 end
  ));
  if c.status in ('missed', 'cancelled') then
    insert into public.notifications (user_id, title, message, type)
    values (c.callee_id, 'Appel manqué', coalesce((select name from public.profiles where id = c.caller_id), ''), 'info');
  end if;
end;
$$;
revoke execute on function public.chat_call_log(public.chat_calls) from public, anon, authenticated;

-- Appels qui sonnent depuis plus de 45 s : manqués
create or replace function public.chat_calls_expire()
returns void language plpgsql security definer set search_path = '' as $$
declare c public.chat_calls;
begin
  for c in update public.chat_calls set status = 'missed', ended_at = now()
           where status = 'ringing' and created_at < now() - interval '45 seconds' returning * loop
    perform public.chat_call_log(c);
  end loop;
  -- Appel resté « en cours » plus de 4 h (onglet fermé brutalement)
  for c in update public.chat_calls set status = 'ended', ended_at = now()
           where status = 'accepted' and answered_at < now() - interval '4 hours' returning * loop
    perform public.chat_call_log(c);
  end loop;
end;
$$;
revoke execute on function public.chat_calls_expire() from public, anon, authenticated;

create or replace function public.chat_call_start(p_conv uuid)
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
  insert into public.chat_calls (conversation_id, caller_id, callee_id) values (p_conv, v_me, v_other) returning * into c;
  return c;
end;
$$;
revoke execute on function public.chat_call_start(uuid) from public, anon;
grant execute on function public.chat_call_start(uuid) to authenticated;

-- p_action : accept, decline, cancel, end, missed, failed
create or replace function public.chat_call_update(p_call uuid, p_action text)
returns public.chat_calls language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); c public.chat_calls; v_status text;
begin
  select * into c from public.chat_calls where id = p_call and (caller_id = v_me or callee_id = v_me) for update;
  if c.id is null then raise exception 'Appel introuvable' using errcode = '42501'; end if;
  if c.status not in ('ringing', 'accepted') then return c; end if;

  if p_action = 'accept' and c.status = 'ringing' and v_me = c.callee_id then
    update public.chat_calls set status = 'accepted', answered_at = now() where id = p_call returning * into c;
    return c;
  end if;
  v_status := case
    when c.status = 'accepted' then case when p_action = 'failed' then 'failed' else 'ended' end
    when p_action = 'decline' and v_me = c.callee_id then 'declined'
    when p_action = 'cancel' and v_me = c.caller_id then 'cancelled'
    when p_action = 'missed' then 'missed'
    when p_action = 'failed' then 'failed'
    else null end;
  if v_status is null then return c; end if;
  update public.chat_calls set status = v_status, ended_at = now() where id = p_call returning * into c;
  perform public.chat_call_log(c);
  return c;
end;
$$;
revoke execute on function public.chat_call_update(uuid, text) from public, anon;
grant execute on function public.chat_call_update(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Fichiers : bucket privé « chat-media » (25 Mo par fichier)
-- ---------------------------------------------------------------------
create or replace function public.chat_can_upload(p_conv text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  begin v := p_conv::uuid; exception when others then return false; end;
  return public.chat_can_send(v);
end;
$$;
revoke execute on function public.chat_can_upload(text) from public, anon;
grant execute on function public.chat_can_upload(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-media', 'chat-media', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "chat media lecture" on storage.objects;
create policy "chat media lecture" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and public.chat_is_member((storage.foldername(name))[1]));
drop policy if exists "chat media depot" on storage.objects;
create policy "chat media depot" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.chat_can_upload((storage.foldername(name))[1])
  );
drop policy if exists "chat media suppression" on storage.objects;
create policy "chat media suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and owner_id = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- 7. Temps réel
--   • changements de tables (messages, réactions, discussions, appels)
--   • canaux privés « chat:<id> » (écrit…, enregistre…, en ligne) et
--     « call:<id> » (signalisation WebRTC), réservés aux deux membres
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['chat_messages', 'chat_reactions', 'chat_conversations', 'chat_calls'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    when undefined_object then raise notice 'publication supabase_realtime absente';
    end;
  end loop;
end $$;

create or replace function public.chat_topic_ok(p_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (p_topic like 'chat:%' or p_topic like 'call:%')
    and public.chat_is_member(split_part(p_topic, ':', 2));
$$;
revoke execute on function public.chat_topic_ok(text) from public, anon;
grant execute on function public.chat_topic_ok(text) to authenticated;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "chat canaux lecture" on realtime.messages';
    execute 'create policy "chat canaux lecture" on realtime.messages for select to authenticated
             using (realtime.messages.extension in (''broadcast'', ''presence'') and public.chat_topic_ok(realtime.topic()))';
    execute 'drop policy if exists "chat canaux envoi" on realtime.messages';
    execute 'create policy "chat canaux envoi" on realtime.messages for insert to authenticated
             with check (realtime.messages.extension in (''broadcast'', ''presence'') and public.chat_topic_ok(realtime.topic()))';
  end if;
end $$;

notify pgrst, 'reload schema';
insert into public.applied_migrations (name) values ('20261114090000_student_teacher_chat') on conflict do nothing;
