-- =====================================================================
-- Administration : équipe admin, offres, abonnements, habilitations
-- ---------------------------------------------------------------------
-- * Les professeurs ne s'inscrivent plus eux-mêmes : l'administration
--   les crée (fonction serveur admin-teachers).
-- * Chaque action du professeur est une permission nommée (catalogue
--   public.permissions). Une offre (public.plans) accorde un lot de
--   permissions + des quotas ; l'abonnement fixe les dates.
-- * public.has_permission(clé) est la seule règle : elle est appelée par
--   les règles RLS et les déclencheurs, donc impossible à contourner
--   depuis le navigateur.
-- * Les professeurs existants passent sur l'offre « Fondateur »
--   (tout illimité, sans date de fin) : rien ne change pour eux.
-- Migration idempotente : peut être relancée sans risque.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'admin')),
  -- admin : null = toutes les permissions d'administration (sauf l'équipe)
  admin_permissions text[],
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.permissions (
  key text primary key,
  module text not null,
  label_fr text not null,
  label_ar text not null,
  label_en text not null,
  kind text not null default 'feature' check (kind in ('feature', 'quota', 'admin')),
  -- false = lecture / export : reste accordée quand l'abonnement est expiré
  is_write boolean not null default true,
  sort_order int not null default 0
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_mad numeric(10, 2) not null default 0,
  billing_period text not null default 'year'
    check (billing_period in ('month', 'quarter', 'semester', 'year', 'school_year', 'custom', 'unlimited')),
  duration_days int,                 -- null = sans date de fin
  trial_days int not null default 0, -- durée quand l'offre est attribuée en essai
  grace_days int not null default 7,
  is_active boolean not null default true,   -- false = archivée (plus proposée)
  is_trial_plan boolean not null default false,
  color text not null default 'indigo',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_permissions (
  plan_id uuid not null references public.plans(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade on update cascade,
  limit_value int,                   -- quotas : null = illimité
  primary key (plan_id, permission_key)
);

create table if not exists public.teacher_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  must_change_password boolean not null default false,
  phone text,
  school text,
  city text,
  subject text,
  notes text,
  suspended_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  kind text not null default 'paid' check (kind in ('trial', 'paid', 'free')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,               -- null = sans date de fin
  grace_days int not null default 7,
  canceled_at timestamptz,
  price_mad numeric(10, 2),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_teacher_idx on public.subscriptions (teacher_id, starts_at desc);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount_mad numeric(10, 2) not null,
  paid_at date not null default current_date,
  method text not null default 'transfer'
    check (method in ('cash', 'transfer', 'card', 'mobile', 'check', 'other')),
  reference text,
  receipt_number text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists payments_teacher_idx on public.payments (teacher_id, paid_at desc);

create table if not exists public.teacher_permission_overrides (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade on update cascade,
  effect text not null check (effect in ('allow', 'deny')),
  limit_value int,                   -- quotas : remplace la limite de l'offre
  expires_at timestamptz,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (teacher_id, permission_key)
);

create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  table_name text,
  target_id text,
  teacher_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_teacher_idx on public.audit_log (teacher_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2. Catalogue des permissions (toute nouvelle fonction ajoute sa clé ici)
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
  ('class.view', 'class', 'Voir ses classes', 'عرض أقسامه', 'View classes', 'feature', false, 10),
  ('class.create', 'class', 'Créer une classe', 'إنشاء قسم', 'Create a class', 'feature', true, 20),
  ('class.edit', 'class', 'Renommer / modifier une classe', 'تعديل قسم', 'Edit a class', 'feature', true, 30),
  ('class.clear', 'class', 'Vider une classe', 'إفراغ قسم', 'Empty a class', 'feature', true, 40),
  ('class.delete', 'class', 'Supprimer une classe', 'حذف قسم', 'Delete a class', 'feature', true, 50),
  ('student.view', 'student', 'Voir les élèves', 'عرض التلاميذ', 'View students', 'feature', false, 60),
  ('student.create', 'student', 'Créer un élève à la main', 'إضافة تلميذ يدويا', 'Create a student', 'feature', true, 70),
  ('student.import_excel', 'student', 'Importer des élèves depuis Excel', 'استيراد التلاميذ من Excel', 'Import students from Excel', 'feature', true, 80),
  ('student.export_excel', 'student', 'Exporter les élèves vers Excel', 'تصدير التلاميذ إلى Excel', 'Export students to Excel', 'feature', false, 90),
  ('student.edit', 'student', 'Modifier une fiche élève', 'تعديل بطاقة تلميذ', 'Edit a student', 'feature', true, 100),
  ('student.delete', 'student', 'Supprimer un élève', 'حذف تلميذ', 'Delete a student', 'feature', true, 110),
  ('student.reset_password', 'student', 'Réinitialiser le mot de passe d''un élève', 'إعادة تعيين كلمة مرور تلميذ', 'Reset a student''s password', 'feature', true, 120),
  ('student.activity_view', 'student', 'Suivre les activités et connexions', 'تتبع الأنشطة والاتصالات', 'Track activity and sessions', 'feature', false, 130),
  ('course.view', 'course', 'Voir les cours', 'عرض الدروس', 'View courses', 'feature', false, 140),
  ('course.edit', 'course', 'Créer / modifier un cours', 'إنشاء / تعديل درس', 'Create / edit a course', 'feature', true, 150),
  ('course.upload_pdf', 'course', 'Joindre des documents (PDF…)', 'إرفاق وثائق (PDF…)', 'Attach documents (PDF…)', 'feature', true, 160),
  ('course.upload_image', 'course', 'Joindre des images', 'إرفاق صور', 'Attach images', 'feature', true, 170),
  ('course.upload_video', 'course', 'Joindre des vidéos', 'إرفاق فيديوهات', 'Attach videos', 'feature', true, 180),
  ('course.delete', 'course', 'Supprimer un cours', 'حذف درس', 'Delete a course', 'feature', true, 190),
  ('exercise.edit', 'exercise', 'Créer / modifier un exercice', 'إنشاء / تعديل تمرين', 'Create / edit an exercise', 'feature', true, 200),
  ('exercise.publish', 'exercise', 'Publier un exercice aux élèves', 'نشر تمرين للتلاميذ', 'Publish an exercise', 'feature', true, 210),
  ('quiz.edit', 'quiz', 'Créer / modifier un quiz', 'إنشاء / تعديل اختبار', 'Create / edit a quiz', 'feature', true, 220),
  ('exam.edit', 'quiz', 'Créer / modifier un examen', 'إنشاء / تعديل امتحان', 'Create / edit an exam', 'feature', true, 230),
  ('quiz.math_editor', 'quiz', 'Éditeur de formules mathématiques', 'محرر الصيغ الرياضية', 'Math formula editor', 'feature', true, 240),
  ('quiz.anti_cheat', 'quiz', 'Anti-triche (plein écran, détection)', 'مكافحة الغش', 'Anti-cheat', 'feature', true, 250),
  ('quiz.publish', 'quiz', 'Publier / programmer un quiz', 'نشر / برمجة اختبار', 'Publish / schedule a quiz', 'feature', true, 260),
  ('quiz.results_view', 'quiz', 'Voir les résultats détaillés', 'عرض النتائج المفصلة', 'View detailed results', 'feature', false, 270),
  ('quiz.results_export', 'quiz', 'Exporter les résultats', 'تصدير النتائج', 'Export results', 'feature', false, 280),
  ('diagnostic.use', 'diagnostic', 'Utiliser l''évaluation diagnostique', 'استعمال التقويم التشخيصي', 'Use diagnostic assessment', 'feature', true, 290),
  ('diagnostic.template1', 'diagnostic', 'Modèle de rapport 1', 'نموذج التقرير 1', 'Report template 1', 'feature', true, 300),
  ('diagnostic.template2', 'diagnostic', 'Modèle de rapport 2', 'نموذج التقرير 2', 'Report template 2', 'feature', true, 310),
  ('diagnostic.charts', 'diagnostic', 'Bibliothèque de graphiques', 'مكتبة المبيانات', 'Chart library', 'feature', true, 320),
  ('diagnostic.export_pdf', 'diagnostic', 'Export PDF / impression du rapport', 'تصدير PDF / طباعة التقرير', 'Export / print report', 'feature', false, 330),
  ('reports.view', 'reports', 'Tableaux de bord et rapports', 'لوحات القيادة والتقارير', 'Dashboards and reports', 'feature', false, 340),
  ('reports.export', 'reports', 'Exporter les rapports', 'تصدير التقارير', 'Export reports', 'feature', false, 350),
  ('notify.send', 'notify', 'Envoyer des notifications aux élèves', 'إرسال إشعارات للتلاميذ', 'Send notifications', 'feature', true, 360),
  ('profile.edit', 'account', 'Modifier son profil et sa photo', 'تعديل الملف الشخصي والصورة', 'Edit profile', 'feature', true, 370),
  ('settings.edit', 'account', 'Paramètres de l''application', 'إعدادات التطبيق', 'App settings', 'feature', true, 380),
  ('classes.max', 'quota', 'Nombre de classes', 'عدد الأقسام', 'Number of classes', 'quota', true, 390),
  ('students.max', 'quota', 'Nombre d''élèves (toutes classes)', 'عدد التلاميذ', 'Number of students', 'quota', true, 400),
  ('storage.max_mb', 'quota', 'Stockage des fichiers (Mo)', 'مساحة التخزين (م.ب)', 'File storage (MB)', 'quota', true, 410),
  ('video.max_mb', 'quota', 'Taille max d''une vidéo (Mo)', 'الحجم الأقصى للفيديو (م.ب)', 'Max video size (MB)', 'quota', true, 420),
  ('quiz.max_per_month', 'quota', 'Quiz et examens créés par mois', 'الاختبارات المنشأة شهريا', 'Quizzes created per month', 'quota', true, 430),
  ('admin.teachers.manage', 'admin', 'Gérer les professeurs', 'تدبير الأساتذة', 'Manage teachers', 'admin', true, 440),
  ('admin.plans.manage', 'admin', 'Gérer les offres', 'تدبير العروض', 'Manage plans', 'admin', true, 450),
  ('admin.subscriptions.manage', 'admin', 'Gérer les abonnements', 'تدبير الاشتراكات', 'Manage subscriptions', 'admin', true, 460),
  ('admin.payments.manage', 'admin', 'Gérer les paiements', 'تدبير الأداءات', 'Manage payments', 'admin', true, 470),
  ('admin.overrides.manage', 'admin', 'Gérer les habilitations par professeur', 'تدبير صلاحيات الأستاذ', 'Manage teacher permissions', 'admin', true, 480),
  ('admin.audit.view', 'admin', 'Consulter le journal', 'الاطلاع على السجل', 'View audit log', 'admin', false, 490),
  ('admin.roles.manage', 'admin', 'Gérer l''équipe d''administration', 'تدبير فريق الإدارة', 'Manage admin team', 'admin', true, 500)
on conflict (key) do update set
  module = excluded.module, label_fr = excluded.label_fr, label_ar = excluded.label_ar,
  label_en = excluded.label_en, kind = excluded.kind, is_write = excluded.is_write,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- 3. Fonctions de contrôle (security definer : lisent les tables
--    protégées sans les exposer)
-- ---------------------------------------------------------------------

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and exists (select 1 from public.user_roles r where r.user_id = uid);
$$;

create or replace function public.has_admin_permission(p_key text, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and exists (
    select 1 from public.user_roles r
    where r.user_id = uid
      and (
        r.role = 'super_admin'
        or (p_key <> 'admin.roles.manage' and (r.admin_permissions is null or p_key = any (r.admin_permissions)))
      )
  );
$$;

create or replace function public.is_professor(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and exists (select 1 from public.profiles p where p.id = uid and p.role = 'professor');
$$;

-- Abonnement en cours et statut calculé à partir des dates
-- statut : none | trial | active | grace | expired | suspended
create or replace function public.subscription_status(uid uuid default auth.uid())
returns table (
  status text,
  subscription_id uuid,
  plan_id uuid,
  plan_name text,
  kind text,
  starts_at timestamptz,
  ends_at timestamptz,
  grace_ends_at timestamptz,
  days_left int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  s record;
  v_account text;
  v_status text;
  v_grace_end timestamptz;
begin
  if uid is null then
    return;
  end if;
  select ta.status into v_account from public.teacher_accounts ta where ta.user_id = uid;

  -- abonnement courant : commencé, non annulé, la date de fin la plus lointaine
  select sub.*, pl.name as pname into s
  from public.subscriptions sub
  join public.plans pl on pl.id = sub.plan_id
  where sub.teacher_id = uid and sub.starts_at <= now() and sub.canceled_at is null
  order by (sub.ends_at is null) desc, sub.ends_at desc
  limit 1;

  if not found then
    -- aucun abonnement en cours : expiré s'il y en a eu un, sinon aucun
    if exists (select 1 from public.subscriptions x where x.teacher_id = uid and x.starts_at <= now()) then
      v_status := 'expired';
    else
      v_status := 'none';
    end if;
    if v_account = 'suspended' then v_status := 'suspended'; end if;
    return query select v_status, null::uuid, null::uuid, null::text, null::text,
      null::timestamptz, null::timestamptz, null::timestamptz, null::int;
    return;
  end if;

  v_grace_end := case when s.ends_at is null then null else s.ends_at + make_interval(days => s.grace_days) end;
  if s.ends_at is null or now() <= s.ends_at then
    v_status := case when s.kind = 'trial' then 'trial' else 'active' end;
  elsif now() <= v_grace_end then
    v_status := 'grace';
  else
    v_status := 'expired';
  end if;
  if v_account = 'suspended' then v_status := 'suspended'; end if;

  return query select v_status, s.id, s.plan_id, s.pname::text, s.kind, s.starts_at, s.ends_at, v_grace_end,
    case when s.ends_at is null then null
         else greatest(0, ceil(extract(epoch from (s.ends_at - now())) / 86400.0))::int end;
end;
$$;

-- LA règle : le professeur peut-il faire cette action ?
-- ordre : admin > suspendu > exception Interdire > exception Autoriser
--         > expiré (lecture seule) > contenu de l'offre
create or replace function public.has_permission(p_key text, uid uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_effect text;
  v_status text;
  v_plan uuid;
  v_write boolean;
begin
  if uid is null then
    return false;
  end if;
  if public.is_admin(uid) then
    return true;
  end if;
  if exists (select 1 from public.teacher_accounts ta where ta.user_id = uid and ta.status = 'suspended') then
    return false;
  end if;

  select o.effect into v_effect
  from public.teacher_permission_overrides o
  where o.teacher_id = uid and o.permission_key = p_key and (o.expires_at is null or o.expires_at > now());
  if v_effect = 'deny' then return false; end if;
  if v_effect = 'allow' then return true; end if;

  select st.status, st.plan_id into v_status, v_plan from public.subscription_status(uid) st;
  if v_status is null or v_status in ('none', 'suspended') then
    return false;
  end if;
  select p.is_write into v_write from public.permissions p where p.key = p_key;
  if v_status = 'expired' then
    -- lecture seule : uniquement les consultations / exports que l'offre contenait
    if coalesce(v_write, true) then
      return false;
    end if;
    return exists (
      select 1 from public.plan_permissions pp
      join public.subscriptions sub on sub.plan_id = pp.plan_id
      where sub.teacher_id = uid and pp.permission_key = p_key);
  end if;
  return exists (select 1 from public.plan_permissions pp where pp.plan_id = v_plan and pp.permission_key = p_key);
end;
$$;

-- Limite d'un quota : null = illimité
create or replace function public.quota_limit(p_key text, uid uuid default auth.uid())
returns int language plpgsql stable security definer set search_path = '' as $$
declare
  v_plan uuid;
  v_found boolean;
  v_limit int;
begin
  if uid is null or public.is_admin(uid) then
    return null;
  end if;
  select true, o.limit_value into v_found, v_limit
  from public.teacher_permission_overrides o
  where o.teacher_id = uid and o.permission_key = p_key and o.effect = 'allow'
    and (o.expires_at is null or o.expires_at > now());
  if v_found then
    return v_limit;
  end if;
  select st.plan_id into v_plan from public.subscription_status(uid) st;
  if v_plan is null then
    return null;
  end if;
  select true, pp.limit_value into v_found, v_limit
  from public.plan_permissions pp where pp.plan_id = v_plan and pp.permission_key = p_key;
  return case when v_found then v_limit else null end;
end;
$$;

-- Consommation actuelle d'un quota
create or replace function public.quota_usage(p_key text, uid uuid default auth.uid())
returns int language plpgsql stable security definer set search_path = '' as $$
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
    select coalesce(ceil(sum(coalesce(cm.file_size, 0)) / 1048576.0), 0)::int into v
    from public.course_materials cm
    join public.courses c on c.id = cm.course_id
    where c.professor_id = uid;
  elsif p_key = 'quiz.max_per_month' then
    select count(*) into v from public.exams e
    join public.courses c on c.id = e.course_id
    where c.professor_id = uid and e.created_at >= date_trunc('month', now());
  end if;
  return coalesce(v, 0);
end;
$$;

-- Erreur lisible (le message est affiché tel quel à l'écran)
create or replace function public.raise_access_error(p_key text, p_quota boolean default false)
returns void language plpgsql set search_path = '' as $$
declare
  v_label text;
begin
  select p.label_fr into v_label from public.permissions p where p.key = p_key;
  if p_quota then
    raise exception 'QUOTA:% — Limite de votre offre atteinte : %', p_key, coalesce(v_label, p_key)
      using errcode = 'P0001';
  end if;
  raise exception 'PERMISSION:% — Non inclus dans votre offre : %', p_key, coalesce(v_label, p_key)
    using errcode = '42501';
end;
$$;

-- Tout ce dont l'interface a besoin, en un seul appel
create or replace function public.my_access()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_role record;
  v_sub record;
  v_account record;
  v_perms jsonb;
  v_quotas jsonb;
begin
  if uid is null then
    return null;
  end if;
  select r.role, r.admin_permissions into v_role from public.user_roles r where r.user_id = uid;
  select * into v_sub from public.subscription_status(uid);
  select ta.status, ta.must_change_password into v_account from public.teacher_accounts ta where ta.user_id = uid;

  select coalesce(jsonb_agg(p.key order by p.sort_order), '[]'::jsonb) into v_perms
  from public.permissions p
  where p.kind = 'feature' and public.has_permission(p.key, uid);

  select coalesce(jsonb_object_agg(p.key, jsonb_build_object(
           'limit', public.quota_limit(p.key, uid),
           'used', public.quota_usage(p.key, uid))), '{}'::jsonb) into v_quotas
  from public.permissions p
  where p.kind = 'quota';

  return jsonb_build_object(
    'is_admin', v_role.role is not null,
    'admin_role', v_role.role,
    'admin_permissions', case when v_role.role is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(p.key), '[]'::jsonb) from public.permissions p
      where p.kind = 'admin' and public.has_admin_permission(p.key, uid)) end,
    'account_status', coalesce(v_account.status, 'active'),
    'must_change_password', coalesce(v_account.must_change_password, false),
    'subscription', jsonb_build_object(
      'status', v_sub.status,
      'plan_id', v_sub.plan_id,
      'plan_name', v_sub.plan_name,
      'kind', v_sub.kind,
      'starts_at', v_sub.starts_at,
      'ends_at', v_sub.ends_at,
      'grace_ends_at', v_sub.grace_ends_at,
      'days_left', v_sub.days_left),
    'permissions', v_perms,
    'quotas', v_quotas
  );
end;
$$;

create or replace function public.clear_must_change_password()
returns void language sql security definer set search_path = '' as $$
  update public.teacher_accounts set must_change_password = false, updated_at = now() where user_id = auth.uid();
$$;

-- Vue d'ensemble des professeurs pour l'espace admin
create or replace function public.admin_teachers()
returns table (
  user_id uuid,
  name text,
  email text,
  avatar_url text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  account_status text,
  phone text,
  school text,
  city text,
  subject text,
  sub_status text,
  plan_id uuid,
  plan_name text,
  sub_kind text,
  ends_at timestamptz,
  days_left int,
  classes_count int,
  students_count int
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration' using errcode = '42501';
  end if;
  return query
  select p.id, p.name::text, coalesce(u.email, p.email)::text, p.avatar_url::text, coalesce(ta.created_at, p.created_at),
         u.last_sign_in_at, coalesce(ta.status, 'active'), ta.phone, ta.school, ta.city, ta.subject,
         st.status, st.plan_id, st.plan_name, st.kind, st.ends_at, st.days_left,
         public.quota_usage('classes.max', p.id), public.quota_usage('students.max', p.id)
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.teacher_accounts ta on ta.user_id = p.id
  left join lateral public.subscription_status(p.id) st on true
  where p.role = 'professor'
    and not exists (select 1 from public.user_roles r where r.user_id = p.id)
  order by p.name;
end;
$$;

-- Permissions effectives d'un professeur (fiche admin, onglet Habilitations)
create or replace function public.effective_permissions(uid uuid)
returns table (key text, allowed boolean, source text, limit_value int, used int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_plan uuid;
  v_status text;
begin
  if not (public.is_admin() or uid = auth.uid()) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  select st.plan_id, st.status into v_plan, v_status from public.subscription_status(uid) st;
  return query
  select p.key,
         case when p.kind = 'quota' then true else public.has_permission(p.key, uid) end,
         case
           when exists (select 1 from public.teacher_permission_overrides o where o.teacher_id = uid
                          and o.permission_key = p.key and (o.expires_at is null or o.expires_at > now()))
             then 'override'
           when v_status in ('expired', 'suspended', 'none') then v_status
           when exists (select 1 from public.plan_permissions pp where pp.plan_id = v_plan and pp.permission_key = p.key)
             then 'plan'
           else 'not_in_plan'
         end,
         case when p.kind = 'quota' then public.quota_limit(p.key, uid) else null end,
         case when p.kind = 'quota' then public.quota_usage(p.key, uid) else null end
  from public.permissions p
  where p.kind <> 'admin'
  order by p.sort_order;
end;
$$;

-- Tableau de bord admin
create or replace function public.admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration' using errcode = '42501';
  end if;
  with t as (select * from public.admin_teachers())
  select jsonb_build_object(
    'teachers', (select count(*) from t),
    'active', (select count(*) from t where t.sub_status = 'active'),
    'trial', (select count(*) from t where t.sub_status = 'trial'),
    'grace', (select count(*) from t where t.sub_status = 'grace'),
    'expired', (select count(*) from t where t.sub_status in ('expired', 'none')),
    'suspended', (select count(*) from t where t.sub_status = 'suspended'),
    'expiring_7', (select count(*) from t where t.ends_at between now() and now() + interval '7 days'),
    'expiring_30', (select count(*) from t where t.ends_at between now() and now() + interval '30 days'),
    'revenue_month', (select coalesce(sum(p.amount_mad), 0) from public.payments p
                      where p.paid_at >= date_trunc('month', now())::date),
    'revenue_year', (select coalesce(sum(p.amount_mad), 0) from public.payments p
                     where p.paid_at >= date_trunc('year', now())::date),
    'students', (select coalesce(sum(t.students_count), 0) from t),
    'requests', (select count(*) from public.subscription_requests r where r.status = 'pending'),
    'by_plan', (select coalesce(jsonb_agg(jsonb_build_object('plan', x.plan_name, 'count', x.n) order by x.n desc), '[]'::jsonb)
                from (select coalesce(t.plan_name, '—') as plan_name, count(*) as n from t
                      where t.sub_status not in ('expired', 'none', 'suspended') group by 1) x)
  ) into v;
  return v;
end;
$$;

-- Équipe d'administration (avec e-mails)
create or replace function public.admin_team()
returns table (user_id uuid, name text, email text, role text, admin_permissions text[], created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration' using errcode = '42501';
  end if;
  return query
  select r.user_id, coalesce(p.name, u.email)::text, u.email::text, r.role, r.admin_permissions, r.created_at, u.last_sign_in_at
  from public.user_roles r
  left join auth.users u on u.id = r.user_id
  left join public.profiles p on p.id = r.user_id
  order by r.created_at;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Journal d'audit (déclencheurs)
-- ---------------------------------------------------------------------

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_teacher text;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new, v_old);
  v_teacher := coalesce(v_row ->> 'teacher_id',
                        case when tg_table_name in ('teacher_accounts', 'user_roles') then v_row ->> 'user_id' end);
  insert into public.audit_log (actor_id, action, table_name, target_id, teacher_id, old_data, new_data)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'plan_id', v_row ->> 'key'),
          v_teacher::uuid, v_old, v_new);
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['plans', 'plan_permissions', 'subscriptions', 'payments',
                           'teacher_permission_overrides', 'teacher_accounts', 'user_roles'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists touch_plans on public.plans;
create trigger touch_plans before update on public.plans for each row execute function public.touch_updated_at();
drop trigger if exists touch_teacher_accounts on public.teacher_accounts;
create trigger touch_teacher_accounts before update on public.teacher_accounts for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 5. RLS des nouvelles tables
-- ---------------------------------------------------------------------

alter table public.user_roles enable row level security;
alter table public.permissions enable row level security;
alter table public.plans enable row level security;
alter table public.plan_permissions enable row level security;
alter table public.teacher_accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.teacher_permission_overrides enable row level security;
alter table public.audit_log enable row level security;

do $$
declare
  pol record;
begin
  -- repartir de zéro sur nos tables (migration rejouable)
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('user_roles', 'permissions', 'plans', 'plan_permissions', 'teacher_accounts',
                        'subscriptions', 'payments', 'teacher_permission_overrides', 'audit_log')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy "lecture catalogue" on public.permissions for select to authenticated using (true);

create policy "lecture offres" on public.plans for select to authenticated
  using (is_active or public.is_admin());
create policy "gestion offres" on public.plans for all to authenticated
  using (public.has_admin_permission('admin.plans.manage'))
  with check (public.has_admin_permission('admin.plans.manage'));

create policy "lecture contenu offres" on public.plan_permissions for select to authenticated using (true);
create policy "gestion contenu offres" on public.plan_permissions for all to authenticated
  using (public.has_admin_permission('admin.plans.manage'))
  with check (public.has_admin_permission('admin.plans.manage'));

create policy "lecture compte prof" on public.teacher_accounts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "gestion comptes profs" on public.teacher_accounts for all to authenticated
  using (public.has_admin_permission('admin.teachers.manage'))
  with check (public.has_admin_permission('admin.teachers.manage'));

create policy "lecture abonnements" on public.subscriptions for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin());
create policy "gestion abonnements" on public.subscriptions for all to authenticated
  using (public.has_admin_permission('admin.subscriptions.manage'))
  with check (public.has_admin_permission('admin.subscriptions.manage'));

create policy "lecture paiements" on public.payments for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin());
create policy "gestion paiements" on public.payments for all to authenticated
  using (public.has_admin_permission('admin.payments.manage'))
  with check (public.has_admin_permission('admin.payments.manage'));

create policy "lecture exceptions" on public.teacher_permission_overrides for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin());
create policy "gestion exceptions" on public.teacher_permission_overrides for all to authenticated
  using (public.has_admin_permission('admin.overrides.manage'))
  with check (public.has_admin_permission('admin.overrides.manage'));

create policy "lecture roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "gestion equipe" on public.user_roles for all to authenticated
  using (public.has_admin_permission('admin.roles.manage') and user_id <> auth.uid())
  with check (public.has_admin_permission('admin.roles.manage') and user_id <> auth.uid());

create policy "lecture journal" on public.audit_log for select to authenticated
  using (public.has_admin_permission('admin.audit.view'));

-- ---------------------------------------------------------------------
-- 6. Application des habilitations sur les tables de l'application
--    Règles RESTRICTIVES : elles s'ajoutent (ET) aux règles existantes,
--    sans les modifier. Elles ne concernent que les comptes professeur.
-- ---------------------------------------------------------------------

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and policyname like 'hab: %'
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Classes
create policy "hab: creer classe" on public.rooms as restrictive for insert to authenticated
  with check (not public.is_professor() or public.has_permission('class.create'));
create policy "hab: modifier classe" on public.rooms as restrictive for update to authenticated
  using (not public.is_professor() or public.has_permission('class.edit'));
create policy "hab: supprimer classe" on public.rooms as restrictive for delete to authenticated
  using (not public.is_professor() or public.has_permission('class.delete'));

-- Cours
create policy "hab: creer cours" on public.courses as restrictive for insert to authenticated
  with check (not public.is_professor() or public.has_permission('course.edit'));
create policy "hab: modifier cours" on public.courses as restrictive for update to authenticated
  using (not public.is_professor() or public.has_permission('course.edit'));
create policy "hab: supprimer cours" on public.courses as restrictive for delete to authenticated
  using (not public.is_professor() or public.has_permission('course.delete'));

-- Supports de cours (l'ajout est contrôlé par le déclencheur plus bas)
create policy "hab: supprimer support" on public.course_materials as restrictive for delete to authenticated
  using (not public.is_professor() or public.has_permission('course.edit'));

-- Exercices
create policy "hab: creer exercice" on public.exercises as restrictive for insert to authenticated
  with check (not public.is_professor() or public.has_permission('exercise.edit'));
create policy "hab: modifier exercice" on public.exercises as restrictive for update to authenticated
  using (not public.is_professor() or public.has_permission('exercise.edit'));
create policy "hab: supprimer exercice" on public.exercises as restrictive for delete to authenticated
  using (not public.is_professor() or public.has_permission('exercise.edit'));

-- Quiz et examens
create policy "hab: creer quiz examen" on public.exams as restrictive for insert to authenticated
  with check (not public.is_professor()
              or public.has_permission(case when type::text = 'exam' then 'exam.edit' else 'quiz.edit' end));
create policy "hab: modifier quiz examen" on public.exams as restrictive for update to authenticated
  using (not public.is_professor()
         or public.has_permission(case when type::text = 'exam' then 'exam.edit' else 'quiz.edit' end));
create policy "hab: supprimer quiz examen" on public.exams as restrictive for delete to authenticated
  using (not public.is_professor()
         or public.has_permission(case when type::text = 'exam' then 'exam.edit' else 'quiz.edit' end));

create policy "hab: creer question" on public.quiz_questions as restrictive for insert to authenticated
  with check (not public.is_professor() or public.has_permission('quiz.edit') or public.has_permission('exam.edit'));
create policy "hab: modifier question" on public.quiz_questions as restrictive for update to authenticated
  using (not public.is_professor() or public.has_permission('quiz.edit') or public.has_permission('exam.edit'));
create policy "hab: supprimer question" on public.quiz_questions as restrictive for delete to authenticated
  using (not public.is_professor() or public.has_permission('quiz.edit') or public.has_permission('exam.edit'));

create policy "hab: creer option" on public.quiz_options as restrictive for insert to authenticated
  with check (not public.is_professor() or public.has_permission('quiz.edit') or public.has_permission('exam.edit'));
create policy "hab: modifier option" on public.quiz_options as restrictive for update to authenticated
  using (not public.is_professor() or public.has_permission('quiz.edit') or public.has_permission('exam.edit'));
create policy "hab: supprimer option" on public.quiz_options as restrictive for delete to authenticated
  using (not public.is_professor() or public.has_permission('quiz.edit') or public.has_permission('exam.edit'));

-- ---------------------------------------------------------------------
-- 7. Quotas (déclencheurs : refus clair au-delà de la limite)
-- ---------------------------------------------------------------------

create or replace function public.enforce_room_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_limit int;
begin
  if auth.uid() is null or public.is_admin(auth.uid()) or new.professor_id is null then
    return new;
  end if;
  v_limit := public.quota_limit('classes.max', new.professor_id);
  if v_limit is not null and public.quota_usage('classes.max', new.professor_id) >= v_limit then
    perform public.raise_access_error('classes.max', true);
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_room_quota on public.rooms;
create trigger enforce_room_quota before insert on public.rooms
  for each row execute function public.enforce_room_quota();

create or replace function public.enforce_exam_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_prof uuid;
  v_limit int;
begin
  if auth.uid() is null or public.is_admin(auth.uid()) then
    return new;
  end if;
  select c.professor_id into v_prof from public.courses c where c.id = new.course_id;
  if v_prof is null then
    return new;
  end if;
  v_limit := public.quota_limit('quiz.max_per_month', v_prof);
  if v_limit is not null and public.quota_usage('quiz.max_per_month', v_prof) >= v_limit then
    perform public.raise_access_error('quiz.max_per_month', true);
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_exam_quota on public.exams;
create trigger enforce_exam_quota before insert on public.exams
  for each row execute function public.enforce_exam_quota();

create or replace function public.enforce_course_material()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_prof uuid;
  v_ext text;
  v_key text;
  v_limit int;
  v_used bigint;
  v_size bigint := coalesce(new.file_size, 0);
begin
  if auth.uid() is null or public.is_admin(auth.uid()) or not public.is_professor(auth.uid()) then
    return new;
  end if;
  select c.professor_id into v_prof from public.courses c where c.id = new.course_id;
  v_prof := coalesce(v_prof, auth.uid());
  v_ext := lower(substring(coalesce(new.file_name, new.file_path, '') from '\.([A-Za-z0-9]+)$'));

  if coalesce(new.file_path, '') ~* '^https?://' then
    v_key := 'course.edit';                       -- lien YouTube / Vimeo / web
  elsif v_ext in ('mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv', '3gp', 'ogv') then
    v_key := 'course.upload_video';
  elsif v_ext in ('jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'svg') then
    v_key := 'course.upload_image';
  else
    v_key := 'course.upload_pdf';
  end if;
  if not public.has_permission(v_key) then
    perform public.raise_access_error(v_key);
  end if;

  if v_key = 'course.upload_video' then
    v_limit := public.quota_limit('video.max_mb', v_prof);
    if v_limit is not null and v_size > v_limit::bigint * 1048576 then
      perform public.raise_access_error('video.max_mb', true);
    end if;
  end if;

  v_limit := public.quota_limit('storage.max_mb', v_prof);
  if v_limit is not null and v_size > 0 then
    select coalesce(sum(coalesce(cm.file_size, 0)), 0) into v_used
    from public.course_materials cm
    join public.courses c on c.id = cm.course_id
    where c.professor_id = v_prof;
    if v_used + v_size > v_limit::bigint * 1048576 then
      perform public.raise_access_error('storage.max_mb', true);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_course_material on public.course_materials;
create trigger enforce_course_material before insert on public.course_materials
  for each row execute function public.enforce_course_material();

-- Un utilisateur ne peut pas changer son propre rôle (élève ↔ professeur)
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin(auth.uid()) then
    raise exception 'Changement de rôle non autorisé' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- L'administration peut lire tous les profils (liste des profs, fiches)
drop policy if exists "admin lecture profils" on public.profiles;
create policy "admin lecture profils" on public.profiles for select to authenticated
  using (public.is_admin());
drop policy if exists "admin modification profils" on public.profiles;
create policy "admin modification profils" on public.profiles for update to authenticated
  using (public.has_admin_permission('admin.teachers.manage'))
  with check (public.has_admin_permission('admin.teachers.manage'));

-- ---------------------------------------------------------------------
-- 8. Offres de départ (modifiables ensuite dans l'espace admin)
--    Les prix sont à 0 : l'administrateur les fixe lui-même.
-- ---------------------------------------------------------------------
do $$
declare
  v_plan uuid;
begin
  -- Fondateur : tout illimité, pour les comptes déjà existants
  if not exists (select 1 from public.plans where name = 'Fondateur') then
    insert into public.plans (name, description, price_mad, billing_period, duration_days, trial_days, grace_days, is_active, color, sort_order)
    values ('Fondateur', 'Comptes créés avant la mise en place des abonnements : toutes les fonctions, sans limite.',
            0, 'unlimited', null, 0, 0, false, 'amber', 0)
    returning id into v_plan;
    insert into public.plan_permissions (plan_id, permission_key, limit_value)
    select v_plan, p.key, null from public.permissions p where p.kind <> 'admin';
  end if;

  if not exists (select 1 from public.plans where name = 'Essai') then
    insert into public.plans (name, description, price_mad, billing_period, duration_days, trial_days, grace_days, is_trial_plan, color, sort_order)
    values ('Essai', 'Découverte de toutes les fonctions avec des limites réduites.', 0, 'custom', 14, 14, 0, true, 'slate', 1)
    returning id into v_plan;
    insert into public.plan_permissions (plan_id, permission_key, limit_value)
    select v_plan, x.k, x.l from (values ('class.view', null::int), ('class.create', null::int), ('class.edit', null::int), ('class.clear', null::int), ('class.delete', null::int), ('student.view', null::int), ('student.create', null::int), ('student.export_excel', null::int), ('student.edit', null::int), ('student.delete', null::int), ('student.reset_password', null::int), ('course.view', null::int), ('course.edit', null::int), ('course.upload_pdf', null::int), ('course.upload_image', null::int), ('course.upload_video', null::int), ('course.delete', null::int), ('exercise.edit', null::int), ('exercise.publish', null::int), ('quiz.edit', null::int), ('exam.edit', null::int), ('quiz.math_editor', null::int), ('quiz.anti_cheat', null::int), ('quiz.publish', null::int), ('quiz.results_view', null::int), ('quiz.results_export', null::int), ('diagnostic.use', null::int), ('diagnostic.template1', null::int), ('diagnostic.template2', null::int), ('diagnostic.charts', null::int), ('diagnostic.export_pdf', null::int), ('reports.view', null::int), ('reports.export', null::int), ('notify.send', null::int), ('profile.edit', null::int), ('settings.edit', null::int), ('classes.max', 2), ('students.max', 60), ('storage.max_mb', 500), ('video.max_mb', 100), ('quiz.max_per_month', 10)) as x(k, l);
  end if;
  if not exists (select 1 from public.plans where name = 'Essentiel') then
    insert into public.plans (name, description, price_mad, billing_period, duration_days, trial_days, grace_days, is_trial_plan, color, sort_order)
    values ('Essentiel', 'L''essentiel pour gérer ses classes, ses cours et ses quiz.', 0, 'school_year', 300, 0, 7, false, 'indigo', 2)
    returning id into v_plan;
    insert into public.plan_permissions (plan_id, permission_key, limit_value)
    select v_plan, x.k, x.l from (values ('class.view', null::int), ('class.create', null::int), ('class.edit', null::int), ('class.clear', null::int), ('class.delete', null::int), ('student.view', null::int), ('student.create', null::int), ('student.export_excel', null::int), ('student.edit', null::int), ('student.delete', null::int), ('student.reset_password', null::int), ('course.view', null::int), ('course.edit', null::int), ('course.upload_pdf', null::int), ('course.upload_image', null::int), ('course.delete', null::int), ('exercise.edit', null::int), ('exercise.publish', null::int), ('quiz.edit', null::int), ('quiz.math_editor', null::int), ('quiz.publish', null::int), ('quiz.results_view', null::int), ('diagnostic.use', null::int), ('diagnostic.template1', null::int), ('diagnostic.export_pdf', null::int), ('reports.view', null::int), ('notify.send', null::int), ('profile.edit', null::int), ('settings.edit', null::int), ('classes.max', 6), ('students.max', 250), ('storage.max_mb', 2000), ('quiz.max_per_month', 60), ('video.max_mb', 0::int)) as x(k, l);
  end if;
  if not exists (select 1 from public.plans where name = 'Pro') then
    insert into public.plans (name, description, price_mad, billing_period, duration_days, trial_days, grace_days, is_trial_plan, color, sort_order)
    values ('Pro', 'Toutes les fonctions : examens, anti-triche, vidéos, rapports avancés.', 0, 'school_year', 300, 0, 7, false, 'violet', 3)
    returning id into v_plan;
    insert into public.plan_permissions (plan_id, permission_key, limit_value)
    select v_plan, x.k, x.l from (values ('class.view', null::int), ('class.create', null::int), ('class.edit', null::int), ('class.clear', null::int), ('class.delete', null::int), ('student.view', null::int), ('student.create', null::int), ('student.import_excel', null::int), ('student.export_excel', null::int), ('student.edit', null::int), ('student.delete', null::int), ('student.reset_password', null::int), ('student.activity_view', null::int), ('course.view', null::int), ('course.edit', null::int), ('course.upload_pdf', null::int), ('course.upload_image', null::int), ('course.upload_video', null::int), ('course.delete', null::int), ('exercise.edit', null::int), ('exercise.publish', null::int), ('quiz.edit', null::int), ('exam.edit', null::int), ('quiz.math_editor', null::int), ('quiz.anti_cheat', null::int), ('quiz.publish', null::int), ('quiz.results_view', null::int), ('quiz.results_export', null::int), ('diagnostic.use', null::int), ('diagnostic.template1', null::int), ('diagnostic.template2', null::int), ('diagnostic.charts', null::int), ('diagnostic.export_pdf', null::int), ('reports.view', null::int), ('reports.export', null::int), ('notify.send', null::int), ('profile.edit', null::int), ('settings.edit', null::int), ('classes.max', null::int), ('students.max', null::int), ('storage.max_mb', 10000), ('video.max_mb', 500), ('quiz.max_per_month', null::int)) as x(k, l);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 9. Comptes existants → offre Fondateur, sans date de fin
-- ---------------------------------------------------------------------
insert into public.teacher_accounts (user_id)
select p.id from public.profiles p
where p.role = 'professor' and exists (select 1 from auth.users u where u.id = p.id)
on conflict (user_id) do nothing;

insert into public.subscriptions (teacher_id, plan_id, kind, starts_at, ends_at, grace_days, notes)
select p.id, (select id from public.plans where name = 'Fondateur' limit 1), 'free', now(), null, 0,
       'Migration : compte existant avant la mise en place des abonnements'
from public.profiles p
where p.role = 'professor'
  and exists (select 1 from auth.users u where u.id = p.id)
  and not exists (select 1 from public.subscriptions s where s.teacher_id = p.id);

-- ---------------------------------------------------------------------
-- 10. Rappels d'expiration (J-7, J-1, début de la période de grâce)
--     Exécutés chaque jour à 7 h (heure UTC) si pg_cron est disponible.
-- ---------------------------------------------------------------------
create or replace function public.send_subscription_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
  v_title text;
  v_msg text;
begin
  for r in
    select t.user_id, t.plan_name, t.ends_at, t.sub_status, t.days_left
    from public.profiles p
    cross join lateral (
      select p.id as user_id, st.plan_name, st.ends_at, st.status as sub_status, st.days_left
      from public.subscription_status(p.id) st
    ) t
    where p.role = 'professor'
  loop
    v_title := null;
    if r.sub_status in ('active', 'trial') and r.days_left in (7, 1) then
      v_title := 'Votre abonnement expire bientôt';
      v_msg := format('Votre offre %s expire dans %s jour(s), le %s. Contactez l''administration pour la renouveler.',
                      r.plan_name, r.days_left, to_char(r.ends_at, 'DD/MM/YYYY'));
    elsif r.sub_status = 'grace' and r.ends_at::date = (now() - interval '1 day')::date then
      v_title := 'Abonnement expiré : période de grâce';
      v_msg := format('Votre offre %s a expiré le %s. Vous gardez l''accès complet quelques jours, puis votre compte passera en lecture seule.',
                      r.plan_name, to_char(r.ends_at, 'DD/MM/YYYY'));
    end if;
    if v_title is not null then
      begin
        insert into public.notifications (user_id, title, message, type, read)
        values (r.user_id, v_title, v_msg, 'warning', false);
        n := n + 1;
      exception when others then
        null;
      end;
    end if;
  end loop;
  return n;
end;
$$;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponible : rappels automatiques désactivés (les bandeaux restent affichés).';
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('rappels-abonnements');
    exception when others then
      null;
    end;
    perform cron.schedule('rappels-abonnements', '0 7 * * *', 'select public.send_subscription_reminders();');
  end if;
exception when others then
  raise notice 'Planification des rappels impossible : %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 11. Droits d'exécution
-- ---------------------------------------------------------------------
revoke execute on function public.send_subscription_reminders() from public, anon, authenticated;
revoke execute on function public.admin_teachers() from anon;
revoke execute on function public.admin_dashboard() from anon;
revoke execute on function public.admin_team() from anon;
grant select on public.permissions, public.plans, public.plan_permissions, public.teacher_accounts,
  public.subscriptions, public.payments, public.teacher_permission_overrides, public.user_roles, public.audit_log
  to authenticated;
grant insert, update, delete on public.plans, public.plan_permissions, public.teacher_accounts,
  public.subscriptions, public.payments, public.teacher_permission_overrides, public.user_roles
  to authenticated;
revoke all on public.audit_log from anon;
grant execute on function public.my_access() to authenticated;
grant execute on function public.has_permission(text, uuid) to authenticated;
grant execute on function public.clear_must_change_password() to authenticated;

-- ---------------------------------------------------------------------
-- PREMIER SUPER ADMINISTRATEUR (à faire une seule fois, à la main) :
--   1. Supabase > Authentication > Users > Add user : votre e-mail
--      d'administration + mot de passe (cocher « Auto Confirm User »).
--   2. Exécuter (en remplaçant l'e-mail) :
--      insert into public.user_roles (user_id, role)
--      select id, 'super_admin' from auth.users where email = 'admin@exemple.com'
--      on conflict (user_id) do update set role = 'super_admin';
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 12. Demandes des professeurs (renouvellement, changement d'offre)
-- ---------------------------------------------------------------------
create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'done', 'rejected')),
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.subscription_requests enable row level security;
drop policy if exists "demandes lecture" on public.subscription_requests;
drop policy if exists "demandes creation" on public.subscription_requests;
drop policy if exists "demandes traitement" on public.subscription_requests;
create policy "demandes lecture" on public.subscription_requests for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin());
create policy "demandes creation" on public.subscription_requests for insert to authenticated
  with check (teacher_id = auth.uid() and status = 'pending');
create policy "demandes traitement" on public.subscription_requests for update to authenticated
  using (public.has_admin_permission('admin.subscriptions.manage'))
  with check (public.has_admin_permission('admin.subscriptions.manage'));
grant select, insert, update on public.subscription_requests to authenticated;
