-- Correctif « Exams > Devoirs maison / Exemples devoirs »
-- Ajouter un devoir échouait (« new row violates row-level security policy for table class_documents ») :
-- la règle de lecture relisait la ligne par son id, invisible pendant sa création.
-- Les règles de lecture testent maintenant directement les colonnes. Relançable.

create or replace function public.cdoc_correction_open(p_doc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select d.correction_visible from public.class_documents d where d.id = p_doc), false);
$$;
revoke execute on function public.cdoc_correction_open(uuid) from public, anon;
grant execute on function public.cdoc_correction_open(uuid) to authenticated;

drop policy if exists "devoirs lecture" on public.class_documents;
create policy "devoirs lecture" on public.class_documents for select to authenticated
  using (
    owner_id = (select auth.uid())
    or public.wb_owns_room(room_id)
    or public.is_admin((select auth.uid()))
    or (
      is_visible
      and public.homework_module_on()
      and public.in_room(room_id, (select auth.uid()))
      and not public.class_module_off(room_id, case when kind = 'homework' then 'homework' else 'examples' end, (select auth.uid()))
    )
  );

drop policy if exists "devoirs fichiers lecture" on public.class_document_files;
create policy "devoirs fichiers lecture" on public.class_document_files for select to authenticated
  using (
    public.cdoc_is_teacher(document_id)
    or public.is_admin((select auth.uid()))
    or (public.cdoc_can_see(document_id) and (role = 'subject' or public.cdoc_correction_open(document_id)))
  );
