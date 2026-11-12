-- =====================================================================
-- Durcissement de la sécurité des profils
--
-- Avant : la table profiles était lisible par tout le monde, y compris
-- sans être connecté (règles « Profiles are viewable by everyone » et
-- « Profiles can be selected by username »), colonne temporary_password
-- comprise. Un élève pouvait aussi changer sa propre classe ou son rôle.
--
-- Après :
--  * lecture réservée aux utilisateurs connectés ;
--  * la colonne temporary_password n'est plus lisible directement :
--      - connexion élève  → student_login_email(code Massar) ;
--      - 1re connexion    → is_my_temporary_password(mot de passe) ;
--      - prof / admin     → room_student_passwords(classe) (ses classes seulement) ;
--  * un élève ne peut plus modifier son rôle, sa classe ni son code Massar.
-- À exécuter à la main dans le SQL Editor. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Lecture : connectés seulement
-- ---------------------------------------------------------------------
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Profiles can be selected by username" on public.profiles;
drop policy if exists "profils lecture connectes" on public.profiles;
create policy "profils lecture connectes" on public.profiles for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- 2. Colonne temporary_password : plus de lecture directe
--    (droits colonne par colonne, recalculés à chaque exécution)
-- ---------------------------------------------------------------------
revoke select on public.profiles from anon;
revoke select on public.profiles from authenticated;
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name <> 'temporary_password';
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;
-- l'écriture (remise à zéro par le prof, effacement par l'élève) reste possible
grant update (temporary_password) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 3. Fonctions de remplacement
-- ---------------------------------------------------------------------
-- Connexion par code Massar : renvoie seulement l'e-mail technique de l'élève
create or replace function public.student_login_email(p_username text)
returns text language sql stable security definer set search_path = '' as $$
  select p.email from public.profiles p
  where p.role = 'student' and lower(p.username) = lower(trim(p_username))
  order by (p.username = trim(p_username)) desc
  limit 1;
$$;
revoke execute on function public.student_login_email(text) from public;
grant execute on function public.student_login_email(text) to anon, authenticated;

-- Première connexion : le mot de passe saisi est-il encore le provisoire ?
create or replace function public.is_my_temporary_password(p_password text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.temporary_password = p_password from public.profiles p where p.id = auth.uid()), false);
$$;
revoke execute on function public.is_my_temporary_password(text) from public, anon;
grant execute on function public.is_my_temporary_password(text) to authenticated;

-- Mots de passe provisoires des élèves d'une classe : prof de la classe ou admin
drop function if exists public.student_temp_passwords(uuid[]);
create or replace function public.room_student_passwords(p_room uuid)
returns table (id uuid, username text, temporary_password text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.temporary_password
  from public.profiles p
  where p.role = 'student'
    and (public.is_admin() or public.owns_room(p_room))
    and (p.room_id = p_room
         or exists (select 1 from public.enrollments e where e.student_id = p.id and e.room_id = p_room));
$$;
revoke execute on function public.room_student_passwords(uuid) from public, anon;
grant execute on function public.room_student_passwords(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Un élève ne modifie pas son rôle, sa classe ni son code Massar
-- ---------------------------------------------------------------------
create or replace function public.profile_protect_student_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and auth.uid() = old.id and old.role = 'student' and not public.is_admin() then
    if new.role is distinct from old.role
       or new.room_id is distinct from old.room_id
       or new.username is distinct from old.username then
      raise exception 'Modification non autorisée' using errcode = '42501';
    end if;
    -- l'élève peut effacer son mot de passe provisoire, pas en choisir un
    if new.temporary_password is not null and new.temporary_password is distinct from old.temporary_password then
      raise exception 'Modification non autorisée' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profile_protect_student_fields on public.profiles;
create trigger profile_protect_student_fields before update on public.profiles
  for each row execute function public.profile_protect_student_fields();
