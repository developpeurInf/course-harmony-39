-- =====================================================================
-- Modules par offre : Non inclus / Partiel / Complet
--
--   * permissions.module = module de l'application (mêmes identifiants que
--     Personnalisation → Modules et que src/lib/permissions.ts → MODULE_LABELS).
--   * Un module est inclus dans une offre dès qu'au moins une de ses fonctions l'est ;
--     sinon il est masqué pour les professeurs de cette offre (menu et pages).
--   * plan_modules : modules « Complet » d'une offre. Ils reçoivent toutes les fonctions
--     du module, y compris celles ajoutées plus tard (déclencheur sur permissions).
--   * Les offres qui ont déjà toutes les fonctions d'un module passent en « Complet ».
--
-- À exécuter à la main dans le SQL Editor de Supabase, APRÈS
-- 20261102090000_permissions_pdf_calendar.sql. Idempotent.
-- =====================================================================

-- 1. Module de chaque habilitation
update public.permissions p set module = x.m
from (values
    ('class.view', 'classManagement'),
    ('class.create', 'classManagement'),
    ('class.edit', 'classManagement'),
    ('class.clear', 'classManagement'),
    ('class.delete', 'classManagement'),
    ('class.calendar', 'calendar'),
    ('student.view', 'students'),
    ('student.create', 'students'),
    ('student.import_excel', 'students'),
    ('student.export_excel', 'students'),
    ('student.edit', 'students'),
    ('student.delete', 'students'),
    ('student.reset_password', 'students'),
    ('student.activity_view', 'studentActivities'),
    ('attendance.manage', 'attendance'),
    ('student.groups', 'followUp'),
    ('course.view', 'courses'),
    ('course.edit', 'courses'),
    ('course.upload_pdf', 'courses'),
    ('course.upload_image', 'courses'),
    ('course.upload_video', 'courses'),
    ('course.delete', 'courses'),
    ('lesson_log.manage', 'lessonLog'),
    ('ai.lesson_plan', 'lessonPlans'),
    ('exercise.edit', 'exercises'),
    ('exercise.publish', 'exercises'),
    ('exercise.review', 'exercises'),
    ('quiz.edit', 'exams'),
    ('exam.edit', 'exams'),
    ('quiz.math_editor', 'exams'),
    ('quiz.anti_cheat', 'exams'),
    ('quiz.publish', 'exams'),
    ('quiz.results_view', 'exams'),
    ('quiz.grade', 'exams'),
    ('quiz.bank', 'questionBank'),
    ('quiz.remediation', 'exams'),
    ('quiz.live', 'exams'),
    ('ai.quiz_generator', 'exams'),
    ('ai.omr', 'exams'),
    ('quiz.results_export', 'exams'),
    ('diagnostic.use', 'diagnostic'),
    ('diagnostic.template1', 'diagnostic'),
    ('diagnostic.template2', 'diagnostic'),
    ('diagnostic.template3', 'diagnostic'),
    ('diagnostic.template4', 'diagnostic'),
    ('ai.diagnostic', 'diagnostic'),
    ('diagnostic.charts', 'diagnostic'),
    ('diagnostic.export_pdf', 'diagnostic'),
    ('reports.view', 'reports'),
    ('reports.export', 'reports'),
    ('student.appreciations', 'followUp'),
    ('reports.parent_report', 'followUp'),
    ('gradebook.manage', 'gradebook'),
    ('pdf.use', 'pdfEditor'),
    ('pdf.annotate', 'pdfEditor'),
    ('pdf.edit', 'pdfEditor'),
    ('pdf.layout', 'pdfEditor'),
    ('pdf.watermark_remove', 'pdfEditor'),
    ('pdf.organize', 'pdfEditor'),
    ('pdf.protect', 'pdfEditor'),
    ('notify.send', 'notifications'),
    ('profile.edit', 'account'),
    ('settings.edit', 'account')
) as x(k, m)
where p.key = x.k and p.module is distinct from x.m;

-- 2. Modules « Complet » des offres
create table if not exists public.plan_modules (
  plan_id    uuid not null references public.plans(id) on delete cascade,
  module     text not null,
  created_at timestamptz not null default now(),
  primary key (plan_id, module)
);
alter table public.plan_modules enable row level security;
grant select on public.plan_modules to authenticated;
grant insert, update, delete on public.plan_modules to authenticated;
drop policy if exists "modules lecture" on public.plan_modules;
create policy "modules lecture" on public.plan_modules for select to authenticated using (true);
drop policy if exists "modules gestion" on public.plan_modules;
create policy "modules gestion" on public.plan_modules for all to authenticated
  using (public.has_admin_permission('admin.plans.manage'))
  with check (public.has_admin_permission('admin.plans.manage'));

-- Passer un module en « Complet » ajoute toutes ses fonctions à l'offre
create or replace function public.plan_module_fill()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.plan_permissions (plan_id, permission_key, limit_value)
  select new.plan_id, p.key, null from public.permissions p
  where p.module = new.module and p.kind = 'feature'
  on conflict (plan_id, permission_key) do nothing;
  return new;
end;
$$;
drop trigger if exists plan_module_fill on public.plan_modules;
create trigger plan_module_fill after insert on public.plan_modules
  for each row execute function public.plan_module_fill();

-- Nouvelle fonction (ou fonction changée de module) : ajoutée aux offres où son module est « Complet »
create or replace function public.permission_follow_full_modules()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'feature' then
    insert into public.plan_permissions (plan_id, permission_key, limit_value)
    select pm.plan_id, new.key, null from public.plan_modules pm
    where pm.module = new.module
    on conflict (plan_id, permission_key) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists permission_follow_full_modules on public.permissions;
create trigger permission_follow_full_modules after insert or update of module on public.permissions
  for each row execute function public.permission_follow_full_modules();

-- Retirer une fonction d'un module « Complet » le fait passer en « Partiel »
create or replace function public.plan_permission_unfull()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.plan_modules pm
  using public.permissions p
  where p.key = old.permission_key and pm.plan_id = old.plan_id and pm.module = p.module;
  return old;
end;
$$;
drop trigger if exists plan_permission_unfull on public.plan_permissions;
create trigger plan_permission_unfull after delete on public.plan_permissions
  for each row execute function public.plan_permission_unfull();

-- 3. Offres qui ont déjà tout un module : « Complet »
insert into public.plan_modules (plan_id, module)
select pl.id, m.module
from public.plans pl
cross join (select distinct module from public.permissions where kind = 'feature') m
where not exists (
  select 1 from public.permissions p
  where p.module = m.module and p.kind = 'feature'
    and not exists (select 1 from public.plan_permissions pp where pp.plan_id = pl.id and pp.permission_key = p.key)
)
on conflict (plan_id, module) do nothing;

-- Journal d'audit (même déclencheur que les autres tables d'administration)
do $$
begin
  if to_regprocedure('public.audit_trigger()') is not null then
    execute 'drop trigger if exists audit_plan_modules on public.plan_modules';
    execute 'create trigger audit_plan_modules after insert or update or delete on public.plan_modules for each row execute function public.audit_trigger()';
  end if;
end $$;

notify pgrst, 'reload schema';
