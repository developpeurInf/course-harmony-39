-- Suppression d'un professeur par l'administration (statut « deleted »)
-- Le compte ne peut plus se connecter, n'a plus aucune permission et disparaît des listes.
-- Ses données (classes, cours, élèves) sont conservées.
alter table public.teacher_accounts add column if not exists deleted_at timestamptz;
alter table public.teacher_accounts drop constraint if exists teacher_accounts_status_check;
alter table public.teacher_accounts add constraint teacher_accounts_status_check
  check (status in ('active', 'suspended', 'deleted'));

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
    if v_account in ('suspended', 'deleted') then v_status := 'suspended'; end if;
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
  if v_account in ('suspended', 'deleted') then v_status := 'suspended'; end if;

  return query select v_status, s.id, s.plan_id, s.pname::text, s.kind, s.starts_at, s.ends_at, v_grace_end,
    case when s.ends_at is null then null
         else greatest(0, ceil(extract(epoch from (s.ends_at - now())) / 86400.0))::int end;
end;
$$;

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
  if exists (select 1 from public.teacher_accounts ta where ta.user_id = uid and ta.status in ('suspended', 'deleted')) then
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
    and coalesce(ta.status, 'active') <> 'deleted'
    and not exists (select 1 from public.user_roles r where r.user_id = p.id)
  order by p.name;
end;
$$;
