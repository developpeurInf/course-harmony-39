-- Réunions : accélère la liste des réunions (appelée par la page Réunions et le bandeau élève).
-- Sans risque : uniquement des index et une version plus légère de meet_expire.
-- Peut être relancée sans problème.

-- Présences encore ouvertes (expiration des absents) et réunions en direct
create index if not exists meeting_attendance_open_idx on public.meeting_attendance (last_seen_at) where left_at is null;
create index if not exists meetings_live_idx on public.meetings (coalesce(host_seen_at, started_at, created_at)) where status = 'live';
-- Compteur de messages par réunion
create index if not exists meeting_messages_alive_idx on public.meeting_messages (meeting_id) where deleted_at is null;

-- N'écrit dans la base que s'il y a vraiment quelque chose à fermer
create or replace function public.meet_expire()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.meeting_attendance a where a.left_at is null and a.last_seen_at < now() - interval '3 minutes') then
    update public.meeting_attendance a set left_at = a.last_seen_at
    where a.left_at is null and a.last_seen_at < now() - interval '3 minutes';
  end if;
  if exists (select 1 from public.meetings m where m.status = 'live' and coalesce(m.host_seen_at, m.started_at, m.created_at) < now() - interval '20 minutes') then
    update public.meetings m set status = 'ended', ended_at = coalesce(m.host_seen_at, now()), updated_at = now()
    where m.status = 'live' and coalesce(m.host_seen_at, m.started_at, m.created_at) < now() - interval '20 minutes';
  end if;
  -- présences restées ouvertes dans une réunion terminée (peu de lignes : seulement les présences ouvertes)
  update public.meeting_attendance a set left_at = coalesce(a.left_at, least(a.last_seen_at, m.ended_at))
  from public.meetings m
  where a.left_at is null and a.meeting_id = m.id and m.status = 'ended';
end;
$$;
revoke execute on function public.meet_expire() from public, anon, authenticated;

analyze public.meetings;
analyze public.meeting_attendance;
analyze public.meeting_messages;

insert into public.applied_migrations (name) values ('20261116100000_class_meetings_perf') on conflict do nothing;
