-- =====================================================================
-- Personnalisation centrale de l'application
--
-- * Une seule ligne (id = 1) ; data jsonb = réglages (voir src/lib/appSettings.ts).
-- * Lecture : tout le monde, y compris la page de connexion (anon).
-- * Écriture : administrateurs avec la permission « admin.settings.manage »
--   (le super administrateur l'a d'office).
-- * Logos / favicon : bucket public « branding ».
-- * Idempotent.
-- =====================================================================

create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.app_settings (id, data) values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;

-- Nouvelle permission d'administration
insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order)
values ('admin.settings.manage', 'admin', 'Personnaliser l''application', 'تخصيص التطبيق', 'Customize the app', 'admin', true, 999)
on conflict (key) do nothing;

drop policy if exists "Réglages lisibles par tous" on public.app_settings;
create policy "Réglages lisibles par tous" on public.app_settings
  for select to anon, authenticated using (true);

drop policy if exists "Réglages modifiables par l'administration" on public.app_settings;
create policy "Réglages modifiables par l'administration" on public.app_settings
  for all to authenticated
  using ((select public.has_admin_permission('admin.settings.manage')))
  with check ((select public.has_admin_permission('admin.settings.manage')) and id = 1);

-- Journal d'audit (même déclencheur que les autres tables d'administration, s'il existe)
do $$
begin
  if to_regprocedure('public.audit_trigger()') is not null then
    execute 'drop trigger if exists audit_app_settings on public.app_settings';
    execute 'create trigger audit_app_settings after insert or update or delete on public.app_settings for each row execute function public.audit_trigger()';
  end if;
end $$;

-- Temps réel : les changements arrivent en direct chez tout le monde
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.app_settings';
  exception when duplicate_object then null;
  when undefined_object then raise notice 'publication supabase_realtime absente';
  end;
end $$;

-- Stockage des logos (bucket public)
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('branding', 'branding', true)
    on conflict (id) do update set public = true;

    execute 'drop policy if exists "branding lecture" on storage.objects';
    execute $p$create policy "branding lecture" on storage.objects for select to anon, authenticated using (bucket_id = 'branding')$p$;
    execute 'drop policy if exists "branding ecriture admin" on storage.objects';
    execute $p$create policy "branding ecriture admin" on storage.objects for insert to authenticated
      with check (bucket_id = 'branding' and (select public.has_admin_permission('admin.settings.manage')))$p$;
    execute 'drop policy if exists "branding modification admin" on storage.objects';
    execute $p$create policy "branding modification admin" on storage.objects for update to authenticated
      using (bucket_id = 'branding' and (select public.has_admin_permission('admin.settings.manage')))$p$;
    execute 'drop policy if exists "branding suppression admin" on storage.objects';
    execute $p$create policy "branding suppression admin" on storage.objects for delete to authenticated
      using (bucket_id = 'branding' and (select public.has_admin_permission('admin.settings.manage')))$p$;
  end if;
end $$;

notify pgrst, 'reload schema';
