-- =====================================================================
-- Labo 3D / AR / VR
--   scènes mathématiques en 3D créées par le professeur à partir de modèles,
--   partagées à une classe (et éventuellement rattachées à un cours),
--   vues par les élèves en 3D, en réalité augmentée ou en réalité virtuelle.
-- À lancer après 20261109090000_new_features_permissions.sql. Relançable.
-- =====================================================================

create table if not exists public.lab3d_scenes (
  id           uuid primary key default gen_random_uuid(),
  professor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 160),
  description  text check (description is null or char_length(description) <= 4000),
  template     text not null check (char_length(template) between 1 and 40),
  params       jsonb not null default '{}'::jsonb,
  room_id      uuid references public.rooms(id) on delete set null,
  course_id    uuid references public.courses(id) on delete set null,
  is_visible   boolean not null default false,
  views        int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_lab3d_professor on public.lab3d_scenes (professor_id, updated_at desc);
create index if not exists idx_lab3d_room on public.lab3d_scenes (room_id) where is_visible;
create index if not exists idx_lab3d_course on public.lab3d_scenes (course_id) where is_visible;

alter table public.lab3d_scenes enable row level security;
grant select, insert, update, delete on public.lab3d_scenes to authenticated;

drop policy if exists "Labo 3D : le professeur gère ses scènes" on public.lab3d_scenes;
create policy "Labo 3D : le professeur gère ses scènes" on public.lab3d_scenes for all to authenticated
  using (professor_id = (select auth.uid()))
  with check (
    professor_id = (select auth.uid())
    and public.has_permission('lab3d.use')
    and (room_id is null or public.owns_room(room_id))
  );

drop policy if exists "Labo 3D : les élèves voient les scènes de leur classe" on public.lab3d_scenes;
create policy "Labo 3D : les élèves voient les scènes de leur classe" on public.lab3d_scenes for select to authenticated
  using (is_visible and room_id is not null and public.in_room(room_id) and public.has_permission('lab3d.use', professor_id));

drop policy if exists "Labo 3D : lecture administration" on public.lab3d_scenes;
create policy "Labo 3D : lecture administration" on public.lab3d_scenes for select to authenticated
  using (public.is_admin(auth.uid()));

-- Compteur de vues (élèves)
create or replace function public.lab3d_viewed(p_scene uuid)
returns void language sql security definer set search_path = '' as $$
  update public.lab3d_scenes set views = views + 1
  where id = p_scene and is_visible and room_id is not null and public.in_room(room_id);
$$;
revoke execute on function public.lab3d_viewed(uuid) from public, anon;
grant execute on function public.lab3d_viewed(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Habilitations
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
  ('lab3d.use',     'lab3d', 'Créer et partager des scènes 3D', 'إنشاء ومشاركة مشاهد ثلاثية الأبعاد', 'Create and share 3D scenes', 'feature', true, 700),
  ('lab3d.ar',      'lab3d', 'Réalité augmentée (AR) pour mes élèves', 'الواقع المعزز لتلاميذي', 'Augmented reality (AR) for my students', 'feature', false, 701),
  ('lab3d.vr',      'lab3d', 'Réalité virtuelle (VR) pour mes élèves', 'الواقع الافتراضي لتلاميذي', 'Virtual reality (VR) for my students', 'feature', false, 702),
  ('lab3d.measure', 'lab3d', 'Outils de mesure AR (mètre, clinomètre)', 'أدوات القياس بالواقع المعزز', 'AR measuring tools (tape, clinometer)', 'feature', false, 703)
on conflict (key) do update set module = excluded.module, label_fr = excluded.label_fr, label_ar = excluded.label_ar,
  label_en = excluded.label_en, is_write = excluded.is_write, sort_order = excluded.sort_order;

insert into public.plan_permissions (plan_id, permission_key, limit_value)
select p.id, k.key, null from public.plans p
cross join (values ('lab3d.use'), ('lab3d.ar'), ('lab3d.vr'), ('lab3d.measure')) as k(key)
on conflict (plan_id, permission_key) do nothing;

-- Ce que l'élève connecté peut utiliser dans le labo (un professeur : selon sa propre offre)
create or replace function public.lab3d_features()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'student') then
    return jsonb_build_object(
      'use',     public.student_teacher_can('lab3d.use'),
      'ar',      public.student_teacher_can('lab3d.ar'),
      'vr',      public.student_teacher_can('lab3d.vr'),
      'measure', public.student_teacher_can('lab3d.measure'));
  end if;
  return jsonb_build_object(
    'use',     public.is_admin(auth.uid()) or public.has_permission('lab3d.use'),
    'ar',      public.is_admin(auth.uid()) or public.has_permission('lab3d.ar'),
    'vr',      public.is_admin(auth.uid()) or public.has_permission('lab3d.vr'),
    'measure', public.is_admin(auth.uid()) or public.has_permission('lab3d.measure'));
end;
$$;
revoke execute on function public.lab3d_features() from public, anon;
grant execute on function public.lab3d_features() to authenticated;

insert into public.applied_migrations (name) values ('20261110090000_lab3d') on conflict do nothing;
