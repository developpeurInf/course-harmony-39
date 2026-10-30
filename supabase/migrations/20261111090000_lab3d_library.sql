-- Labo 3D : lien entre une scène et le labo de la bibliothèque (programme marocain) dont elle est issue
alter table public.lab3d_scenes
  add column if not exists lab_id text check (lab_id is null or char_length(lab_id) <= 80);

insert into public.applied_migrations (name) values ('20261111090000_lab3d_library') on conflict do nothing;
