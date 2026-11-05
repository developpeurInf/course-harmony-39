-- P13 : clôture en UNE requête des sessions élève restées ouvertes (onglet fermé brutalement…)
-- Avant : le client lisait les sessions actives puis envoyait un UPDATE par session.
-- Fin de session = dernière activité connue (sinon maintenant), jamais avant le début ;
-- durée = minutes arrondies (comme Math.round côté client), jamais négative.

create or replace function public.close_my_stale_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
begin
  if v_uid is null then
    return 0;
  end if;

  with closed as (
    update public.student_sessions s
       set is_active = false,
           session_end = greatest(s.session_start, coalesce(s.last_activity, now())),
           duration_minutes = greatest(0, round(
             extract(epoch from (greatest(s.session_start, coalesce(s.last_activity, now())) - s.session_start)) / 60.0
           ))::integer
     where s.student_id = v_uid
       and s.is_active
    returning 1
  )
  select count(*)::integer into v_count from closed;

  return v_count;
end;
$$;

revoke all on function public.close_my_stale_sessions() from public;
revoke all on function public.close_my_stale_sessions() from anon;
grant execute on function public.close_my_stale_sessions() to authenticated;
