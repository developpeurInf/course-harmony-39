-- =====================================================================
-- Vitesse : index et règles d'accès plus rapides pour les nouvelles parties
-- (Exams › Devoirs maison / Exemples devoirs, tableaux blancs de classe).
-- Ne change AUCUN droit : mêmes règles, simplement calculées une fois par requête
-- au lieu d'une fois par ligne. Relançable sans risque.
-- =====================================================================

begin;

-- 1. Index manquants (signalés par le conseiller « Performance » de Supabase)
create index if not exists class_documents_owner_idx on public.class_documents (owner_id);
-- liste « toutes mes classes » (élève : /homework, /exam-examples) : filtre par type, tri par date
create index if not exists class_documents_kind_created_idx on public.class_documents (kind, created_at desc);
create index if not exists class_whiteboards_updated_by_idx on public.class_whiteboards (updated_by);

-- 2. Tableaux blancs de classe : auth.uid() lu une seule fois par requête
drop policy if exists "tableaux creation" on public.class_whiteboards;
create policy "tableaux creation" on public.class_whiteboards for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.wb_owns_room(room_id));

drop policy if exists "tableaux lecture" on public.class_whiteboards;
create policy "tableaux lecture" on public.class_whiteboards for select to authenticated
  using (
    owner_id = (select auth.uid())
    or public.wb_owns_room(room_id)
    or (share <> 'private' and public.in_room(room_id, (select auth.uid())))
  );

drop policy if exists "tableaux modification" on public.class_whiteboards;
create policy "tableaux modification" on public.class_whiteboards for update to authenticated
  using (
    owner_id = (select auth.uid())
    or public.wb_owns_room(room_id)
    or (share = 'edit' and public.in_room(room_id, (select auth.uid())))
  )
  with check (
    owner_id = (select auth.uid())
    or public.wb_owns_room(room_id)
    or (share = 'edit' and public.in_room(room_id, (select auth.uid())))
  );

drop policy if exists "tableaux suppression" on public.class_whiteboards;
create policy "tableaux suppression" on public.class_whiteboards for delete to authenticated
  using (owner_id = (select auth.uid()) or public.wb_owns_room(room_id));

commit;

analyze public.class_documents;
analyze public.class_document_files;
