-- =====================================================================
-- Tableaux blancs de classe (menu de la classe → « Tableau blanc »)
--   • le professeur d'une classe crée autant de tableaux qu'il veut
--   • partage par tableau : privé (prof seul) · lecture (élèves de la classe)
--     · collaboratif (les élèves de la classe peuvent écrire)
--   • le contenu (traits, formes, textes, notes, images) est un document JSON
--     enregistré automatiquement ; la collaboration en direct passe par
--     Supabase Realtime (canal de diffusion), rien à activer en plus
-- À lancer dans le SQL Editor de Supabase. Relançable sans risque.
-- =====================================================================

create table if not exists public.class_whiteboards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null default 'Tableau blanc' check (char_length(title) between 1 and 120),
  share text not null default 'view' check (share in ('private', 'view', 'edit')),
  data jsonb not null default '{"board": [], "state": {}}'::jsonb,
  thumb text check (thumb is null or char_length(thumb) <= 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint class_whiteboards_size check (octet_length(data::text) <= 12000000)
);
create index if not exists class_whiteboards_room_idx on public.class_whiteboards (room_id, updated_at desc);
create index if not exists class_whiteboards_owner_idx on public.class_whiteboards (owner_id, updated_at desc);

alter table public.class_whiteboards enable row level security;

-- Professeur de la classe
create or replace function public.wb_owns_room(p_room uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and exists (select 1 from public.rooms r where r.id = p_room and r.professor_id = uid);
$$;
revoke execute on function public.wb_owns_room(uuid, uuid) from public, anon;
grant execute on function public.wb_owns_room(uuid, uuid) to authenticated;

drop policy if exists "tableaux lecture" on public.class_whiteboards;
create policy "tableaux lecture" on public.class_whiteboards for select to authenticated
  using (owner_id = auth.uid() or public.wb_owns_room(room_id) or (share <> 'private' and public.in_room(room_id, auth.uid())));

drop policy if exists "tableaux creation" on public.class_whiteboards;
create policy "tableaux creation" on public.class_whiteboards for insert to authenticated
  with check (owner_id = auth.uid() and public.wb_owns_room(room_id));

drop policy if exists "tableaux modification" on public.class_whiteboards;
create policy "tableaux modification" on public.class_whiteboards for update to authenticated
  using (owner_id = auth.uid() or public.wb_owns_room(room_id) or (share = 'edit' and public.in_room(room_id, auth.uid())))
  with check (owner_id = auth.uid() or public.wb_owns_room(room_id) or (share = 'edit' and public.in_room(room_id, auth.uid())));

drop policy if exists "tableaux suppression" on public.class_whiteboards;
create policy "tableaux suppression" on public.class_whiteboards for delete to authenticated
  using (owner_id = auth.uid() or public.wb_owns_room(room_id));

-- Un élève ne peut changer que le contenu (pas le titre, le partage ni la classe)
create or replace function public.wb_before_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not (old.owner_id = auth.uid() or public.wb_owns_room(old.room_id)) then
    new.title := old.title;
    new.share := old.share;
    new.room_id := old.room_id;
    new.owner_id := old.owner_id;
  else
    new.room_id := old.room_id;
    new.owner_id := old.owner_id;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists wb_before_update on public.class_whiteboards;
create trigger wb_before_update before update on public.class_whiteboards
  for each row execute function public.wb_before_update();

grant select, insert, update, delete on public.class_whiteboards to authenticated;
