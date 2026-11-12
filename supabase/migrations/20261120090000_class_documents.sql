-- =====================================================================
-- « Exams » d'une classe : Devoirs maison et Exemples devoirs
--   • le professeur dépose des sujets et des corrigés dans n'importe quel
--     format (PDF, images, Word, Excel, PowerPoint, GeoGebra, archives…)
--   • les élèves de la classe les consultent et les téléchargent
--   • un corrigé reste caché aux élèves tant que le professeur ne l'a pas publié
--   • habilitations : module d'administration « homework », fonction d'offre
--     « homework.manage », modules de classe « homework » et « examples »
-- À lancer dans le SQL Editor de Supabase. Relançable sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catalogue des habilitations
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
  ('homework.manage', 'homework', 'Déposer des devoirs maison et des exemples d''examens corrigés', 'وضع فروض منزلية ونماذج امتحانات مصححة', 'Upload homework and corrected sample exams', 'feature', true, 476)
on conflict (key) do update set module = excluded.module, label_fr = excluded.label_fr, label_ar = excluded.label_ar,
  label_en = excluded.label_en, is_write = excluded.is_write, sort_order = excluded.sort_order;

-- Les offres existantes reçoivent la nouvelle fonction (à retirer offre par offre si besoin)
insert into public.plan_permissions (plan_id, permission_key, limit_value)
select p.id, 'homework.manage', null from public.plans p
on conflict (plan_id, permission_key) do nothing;

-- Module allumé dans Administration › Personnalisation › Modules ? (absent = allumé)
create or replace function public.homework_module_on()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (a.data -> 'features' ->> 'homework')::boolean from public.app_settings a where a.id = 1), true);
$$;
grant execute on function public.homework_module_on() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------
create table if not exists public.class_documents (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('homework', 'example')),
  title text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 5000),
  due_at timestamptz,
  is_visible boolean not null default true,
  correction_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists class_documents_room_idx on public.class_documents (room_id, kind, created_at desc);

create table if not exists public.class_document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.class_documents(id) on delete cascade,
  role text not null default 'subject' check (role in ('subject', 'correction')),
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_path text not null unique,
  file_size bigint not null default 0,
  mime_type text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists class_document_files_doc_idx on public.class_document_files (document_id, role, position);

alter table public.class_documents enable row level security;
alter table public.class_document_files enable row level security;

-- ---------------------------------------------------------------------
-- 3. Règles d'accès
-- ---------------------------------------------------------------------
-- Le document est-il ouvert à cet utilisateur ? (professeur de la classe : toujours)
create or replace function public.cdoc_can_see(p_doc uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and exists (
    select 1 from public.class_documents d
    where d.id = p_doc and (
      d.owner_id = uid
      or exists (select 1 from public.rooms r where r.id = d.room_id and r.professor_id = uid)
      or public.is_admin(uid)
      or (
        d.is_visible
        and public.homework_module_on()
        and public.in_room(d.room_id, uid)
        and not public.class_module_off(d.room_id, case when d.kind = 'homework' then 'homework' else 'examples' end, uid)
      )
    )
  );
$$;

-- Le professeur de la classe du document (pour écrire)
create or replace function public.cdoc_is_teacher(p_doc uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and exists (
    select 1 from public.class_documents d join public.rooms r on r.id = d.room_id
    where d.id = p_doc and r.professor_id = uid
  );
$$;

-- Un fichier est-il lisible ? Corrigé : seulement une fois publié par le professeur
create or replace function public.cdoc_file_can_see(p_path text, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and exists (
    select 1 from public.class_document_files f
    join public.class_documents d on d.id = f.document_id
    where f.file_path = p_path
      and public.cdoc_can_see(d.id, uid)
      and (f.role = 'subject' or d.correction_visible or public.cdoc_is_teacher(d.id, uid) or public.is_admin(uid))
  );
$$;

revoke execute on function public.cdoc_can_see(uuid, uuid) from public, anon;
revoke execute on function public.cdoc_is_teacher(uuid, uuid) from public, anon;
revoke execute on function public.cdoc_file_can_see(text, uuid) from public, anon;
grant execute on function public.cdoc_can_see(uuid, uuid) to authenticated;
grant execute on function public.cdoc_is_teacher(uuid, uuid) to authenticated;
grant execute on function public.cdoc_file_can_see(text, uuid) to authenticated;

-- Documents
drop policy if exists "devoirs lecture" on public.class_documents;
create policy "devoirs lecture" on public.class_documents for select to authenticated
  using (public.cdoc_can_see(id, (select auth.uid())));

drop policy if exists "devoirs creation" on public.class_documents;
create policy "devoirs creation" on public.class_documents for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.wb_owns_room(room_id) and public.has_permission('homework.manage'));

drop policy if exists "devoirs modification" on public.class_documents;
create policy "devoirs modification" on public.class_documents for update to authenticated
  using (public.wb_owns_room(room_id))
  with check (public.wb_owns_room(room_id) and public.has_permission('homework.manage'));

drop policy if exists "devoirs suppression" on public.class_documents;
create policy "devoirs suppression" on public.class_documents for delete to authenticated
  using (public.wb_owns_room(room_id));

-- Fichiers : un élève ne voit pas les lignes des corrigés non publiés
drop policy if exists "devoirs fichiers lecture" on public.class_document_files;
create policy "devoirs fichiers lecture" on public.class_document_files for select to authenticated
  using (public.cdoc_file_can_see(file_path, (select auth.uid())));

drop policy if exists "devoirs fichiers creation" on public.class_document_files;
create policy "devoirs fichiers creation" on public.class_document_files for insert to authenticated
  with check (public.cdoc_is_teacher(document_id) and public.has_permission('homework.manage'));

drop policy if exists "devoirs fichiers modification" on public.class_document_files;
create policy "devoirs fichiers modification" on public.class_document_files for update to authenticated
  using (public.cdoc_is_teacher(document_id))
  with check (public.cdoc_is_teacher(document_id));

drop policy if exists "devoirs fichiers suppression" on public.class_document_files;
create policy "devoirs fichiers suppression" on public.class_document_files for delete to authenticated
  using (public.cdoc_is_teacher(document_id));

grant select, insert, update, delete on public.class_documents to authenticated;
grant select, insert, update, delete on public.class_document_files to authenticated;

-- La classe et l'auteur ne changent pas ; date de mise à jour
create or replace function public.cdoc_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.room_id := old.room_id;
  new.owner_id := old.owner_id;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists cdoc_before_update on public.class_documents;
create trigger cdoc_before_update before update on public.class_documents
  for each row execute function public.cdoc_before_update();

-- Quota de stockage de l'offre (storage.max_mb) : cours + devoirs
create or replace function public.cdoc_enforce_file()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_prof uuid;
  v_limit int;
  v_used bigint;
  v_size bigint := coalesce(new.file_size, 0);
begin
  if auth.uid() is null or public.is_admin(auth.uid()) then return new; end if;
  select r.professor_id into v_prof
  from public.class_documents d join public.rooms r on r.id = d.room_id where d.id = new.document_id;
  v_prof := coalesce(v_prof, auth.uid());
  v_limit := public.quota_limit('storage.max_mb', v_prof);
  if v_limit is not null and v_size > 0 then
    select coalesce((select sum(coalesce(cm.file_size, 0)) from public.course_materials cm
                     join public.courses c on c.id = cm.course_id where c.professor_id = v_prof), 0)
         + coalesce((select sum(f.file_size) from public.class_document_files f
                     join public.class_documents d on d.id = f.document_id
                     join public.rooms r on r.id = d.room_id where r.professor_id = v_prof), 0)
      into v_used;
    if v_used + v_size > v_limit::bigint * 1048576 then
      perform public.raise_access_error('storage.max_mb', true);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists cdoc_enforce_file on public.class_document_files;
create trigger cdoc_enforce_file before insert on public.class_document_files
  for each row execute function public.cdoc_enforce_file();

-- Le compteur « Stockage » de l'abonnement compte aussi les devoirs
create or replace function public.quota_usage(p_key text, uid uuid default auth.uid())
returns integer language plpgsql stable security definer set search_path = '' as $$
declare
  v int := 0;
begin
  if uid is null then
    return 0;
  end if;
  if p_key = 'classes.max' then
    select count(*) into v from public.rooms r where r.professor_id = uid;
  elsif p_key = 'students.max' then
    select count(*) into v from public.profiles p
    where p.role = 'student' and p.room_id in (select r.id from public.rooms r where r.professor_id = uid);
  elsif p_key = 'storage.max_mb' then
    select coalesce(ceil((
        coalesce((select sum(coalesce(cm.file_size, 0)) from public.course_materials cm
                  join public.courses c on c.id = cm.course_id where c.professor_id = uid), 0)
      + coalesce((select sum(f.file_size) from public.class_document_files f
                  join public.class_documents d on d.id = f.document_id
                  join public.rooms r on r.id = d.room_id where r.professor_id = uid), 0)
      ) / 1048576.0), 0)::int into v;
  elsif p_key = 'quiz.max_per_month' then
    select count(*) into v from public.exams e
    join public.courses c on c.id = e.course_id
    where c.professor_id = uid and e.created_at >= date_trunc('month', now());
  end if;
  return coalesce(v, 0);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Fichiers : bucket privé « class-documents » (50 Mo par fichier, tout format)
--    chemin : <room_id>/<document_id>/<nom>
-- ---------------------------------------------------------------------
create or replace function public.cdoc_can_upload(p_room text, p_doc text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare r uuid; d uuid;
begin
  begin r := p_room::uuid; d := p_doc::uuid; exception when others then return false; end;
  return public.wb_owns_room(r) and public.has_permission('homework.manage')
    and exists (select 1 from public.class_documents x where x.id = d and x.room_id = r);
end;
$$;
create or replace function public.cdoc_room_teacher(p_room text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare r uuid;
begin
  begin r := p_room::uuid; exception when others then return false; end;
  return public.wb_owns_room(r);
end;
$$;
revoke execute on function public.cdoc_can_upload(text, text) from public, anon;
revoke execute on function public.cdoc_room_teacher(text) from public, anon;
grant execute on function public.cdoc_can_upload(text, text) to authenticated;
grant execute on function public.cdoc_room_teacher(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('class-documents', 'class-documents', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "devoirs stockage lecture" on storage.objects;
create policy "devoirs stockage lecture" on storage.objects for select to authenticated
  using (bucket_id = 'class-documents'
         and (public.cdoc_room_teacher((storage.foldername(name))[1]) or public.cdoc_file_can_see(name)));

drop policy if exists "devoirs stockage depot" on storage.objects;
create policy "devoirs stockage depot" on storage.objects for insert to authenticated
  with check (bucket_id = 'class-documents'
              and public.cdoc_can_upload((storage.foldername(name))[1], (storage.foldername(name))[2]));

drop policy if exists "devoirs stockage suppression" on storage.objects;
create policy "devoirs stockage suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'class-documents' and public.cdoc_room_teacher((storage.foldername(name))[1]));
