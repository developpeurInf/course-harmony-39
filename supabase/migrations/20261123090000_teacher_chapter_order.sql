-- Ordre des chapitres choisi par chaque professeur (rubriques « proposés »).
-- À exécuter à la main dans le SQL Editor de Supabase. Sans cette table, l'ordre reste sur l'appareil.
create table if not exists public.teacher_chapter_order (
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null,
  subject text not null,
  chapter_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, level, subject)
);
alter table public.teacher_chapter_order enable row level security;
drop policy if exists "chapter order: own rows" on public.teacher_chapter_order;
create policy "chapter order: own rows" on public.teacher_chapter_order
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
notify pgrst, 'reload schema';
