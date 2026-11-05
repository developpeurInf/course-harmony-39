-- =====================================================================
-- Pièces jointes multiples pour les exercices (comme course_materials).
--
-- * Idempotent : peut être exécuté plusieurs fois sans erreur.
-- * Une ligne = un fichier du bucket « course-materials »
--   (file_path = "courses/<course_id>/exercise_<id>_….<ext>") ou un lien vidéo
--   externe (file_path = "https://…" — YouTube, Vimeo, .mp4). Le type est déduit
--   du chemin / nom côté application (src/lib/courseMedia.ts), comme pour les cours.
-- * La colonne exercises.pdf_url est conservée (compatibilité) : elle pointe vers
--   le dernier PDF joint.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table + index
-- ---------------------------------------------------------------------
create table if not exists public.exercise_materials (
  id          uuid primary key default gen_random_uuid(),
  exercise_id uuid references public.exercises(id) on delete cascade,
  file_name   text,
  file_path   text,
  file_size   bigint,
  mime_type   text,
  uploaded_at timestamptz default now(),
  uploaded_by uuid references auth.users(id) on delete set null
);

-- colonnes ajoutées après coup si une version antérieure de la table existe
alter table public.exercise_materials add column if not exists mime_type   text;
alter table public.exercise_materials add column if not exists file_size   bigint;
alter table public.exercise_materials add column if not exists uploaded_at timestamptz default now();

create index if not exists idx_exercise_materials_exercise_id
  on public.exercise_materials (exercise_id, uploaded_at);

alter table public.exercise_materials enable row level security;

grant select, insert, update, delete on public.exercise_materials to authenticated;

-- ---------------------------------------------------------------------
-- 2. Droit d'accès à un exercice (SECURITY DEFINER : évalué sans dépendre
--    des règles RLS des tables exercises / courses / profiles / enrollments)
--    p_manage = true  → seul le professeur propriétaire du cours
--    p_manage = false → + élèves qui voient l'exercice : exercice visible,
--                       cours visible, élève dans la classe du cours
--                       (profiles.room_id) ou inscrit au cours (enrollments)
--    (même logique que getVisibleExercisesForStudent dans CourseContext)
-- ---------------------------------------------------------------------
create or replace function public.can_access_exercise(p_exercise_id uuid, p_manage boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.exercises e
    join public.courses c on c.id = e.course_id
    where e.id = p_exercise_id
      and (
        c.professor_id = auth.uid()
        or (
          not p_manage
          and coalesce(e.is_visible, false)
          and coalesce(c.is_visible, true)
          and (
            exists (
              select 1 from public.profiles p
              where p.id = auth.uid() and p.room_id is not null and p.room_id = c.room_id
            )
            or exists (
              select 1 from public.enrollments en
              where en.student_id = auth.uid() and en.course_id = c.id
            )
          )
        )
      )
  );
$$;

revoke all on function public.can_access_exercise(uuid, boolean) from public;
grant execute on function public.can_access_exercise(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Règles RLS
-- ---------------------------------------------------------------------
drop policy if exists "Exercise materials readable" on public.exercise_materials;
create policy "Exercise materials readable" on public.exercise_materials
  for select to authenticated
  using ((select public.is_admin()) or public.can_access_exercise(exercise_id, false));

drop policy if exists "Professors insert exercise materials" on public.exercise_materials;
create policy "Professors insert exercise materials" on public.exercise_materials
  for insert to authenticated
  with check (
    public.can_access_exercise(exercise_id, true)
    and (uploaded_by is null or uploaded_by = (select auth.uid()))
  );

drop policy if exists "Professors update exercise materials" on public.exercise_materials;
create policy "Professors update exercise materials" on public.exercise_materials
  for update to authenticated
  using (public.can_access_exercise(exercise_id, true))
  with check (public.can_access_exercise(exercise_id, true));

drop policy if exists "Professors delete exercise materials" on public.exercise_materials;
create policy "Professors delete exercise materials" on public.exercise_materials
  for delete to authenticated
  using (public.can_access_exercise(exercise_id, true));

-- Règles « hab: » (RESTRICTIVES), même motif initPlan que 20261014090000_perf_indexes_rls.sql
do $$
declare
  spec record;
begin
  if to_regprocedure('public.is_professor(uuid)') is null
     or to_regprocedure('public.has_permission(text, uuid)') is null then
    raise notice 'fonctions is_professor / has_permission absentes : règles « hab: » des pièces jointes non créées';
    return;
  end if;

  for spec in
    select * from (values
      ('hab: creer piece exercice',     'insert', 'with check',
       '(not (select public.is_professor()) or (select public.has_permission(''exercise.edit'')))'),
      ('hab: modifier piece exercice',  'update', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''exercise.edit'')))'),
      ('hab: supprimer piece exercice', 'delete', 'using',
       '(not (select public.is_professor()) or (select public.has_permission(''exercise.edit'')))')
    ) as t(pol, cmd, clause, expr)
  loop
    execute format('drop policy if exists %I on public.exercise_materials', spec.pol);
    execute format('create policy %I on public.exercise_materials as restrictive for %s to authenticated %s %s',
                   spec.pol, spec.cmd, spec.clause, spec.expr);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Reprise des anciens fichiers (exercises.pdf_url → une ligne par exercice)
--    seulement pour les exercices qui n'ont encore aucune pièce jointe.
-- ---------------------------------------------------------------------
insert into public.exercise_materials (exercise_id, file_name, file_path, file_size, mime_type, uploaded_at, uploaded_by)
select
  e.id,
  case
    when lower(src.path) ~ '\.pdf$' then coalesce(nullif(btrim(e.title), ''), 'exercice') || '.pdf'
    else regexp_replace(src.path, '^.*/', '')
  end,
  src.path,
  null,
  case when lower(src.path) ~ '\.pdf$' then 'application/pdf' else null end,
  coalesce(e.updated_at, e.created_at, now()),
  -- seulement si le professeur existe encore dans auth.users (clé étrangère)
  (select u.id from auth.users u where u.id = c.professor_id)
from public.exercises e
left join public.courses c on c.id = e.course_id
cross join lateral (
  select coalesce(
    -- URL publique Supabase : on garde le chemin après « /course-materials/ » (sans ?query / #fragment)
    nullif(split_part(split_part(substring(e.pdf_url from '/course-materials/(.*)$'), '?', 1), '#', 1), ''),
    e.pdf_url
  ) as path
) src
where e.pdf_url is not null
  and btrim(e.pdf_url) <> ''
  and not exists (select 1 from public.exercise_materials m where m.exercise_id = e.id);

-- NB : course_materials n'est pas dans la publication supabase_realtime → exercise_materials non plus.
