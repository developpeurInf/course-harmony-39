-- Habilitations appliquées instantanément + lecture contrôlée
-- 1) Les changements faits par l'administration sont envoyés en temps réel à l'application
--    du professeur (Supabase Realtime) : plus besoin de se reconnecter.
do $$
declare
  t text;
begin
  foreach t in array array['teacher_permission_overrides', 'subscriptions', 'teacher_accounts', 'plan_permissions'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null; -- déjà dans la publication
    when undefined_object then
      raise notice 'publication supabase_realtime absente';
    end;
  end loop;
end $$;

-- 2) « Voir ses classes » et « Voir les cours » contrôlés aussi dans la base
--    (sans effet pour les élèves ni pour l'administration).
drop policy if exists "hab: voir classes" on public.rooms;
create policy "hab: voir classes" on public.rooms as restrictive for select to authenticated
  using (not public.is_professor() or public.has_permission('class.view'));

drop policy if exists "hab: voir cours" on public.courses;
create policy "hab: voir cours" on public.courses as restrictive for select to authenticated
  using (not public.is_professor() or public.has_permission('course.view'));
