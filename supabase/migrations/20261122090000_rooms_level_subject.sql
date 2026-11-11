-- Niveau, matière et lycée de chaque classe (rubriques « proposés » et en-tête des PDF).
-- À exécuter à la main dans le SQL Editor de Supabase.
alter table public.rooms add column if not exists level text;
alter table public.rooms add column if not exists subject text;
alter table public.rooms add column if not exists school_name text;

do $$ begin
  alter table public.rooms add constraint rooms_level_check check (level is null or level in ('tc', '1bac', '2bac'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.rooms add constraint rooms_subject_check check (subject is null or subject in ('pc', 'math', 'svt'));
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
