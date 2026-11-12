-- =====================================================================
-- Outils d'administration
--   A. Annonces (bandeau) pour tous, les profs, les élèves ou une offre
--   B. Statistiques : revenus sur 12 mois, profs actifs, usage IA, renouvellements
--   C. Notes internes de l'administration sur un professeur
--   D. Codes promo et parrainage (appliqués à la validation du paiement)
--   E. Remboursement d'un paiement
--   F. Relances automatiques avant la fin d'un abonnement (notifications)
--   G. Activité d'un professeur (fiche admin)
--   H. Offres : visibles ou sur invitation, prix barré
--   I. Personnalisation : historique des versions et retour arrière
--   J. Double authentification obligatoire pour l'équipe (réglage)
-- À exécuter à la main dans le SQL Editor, APRÈS 20261029120000_teacher_payments.sql.
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- J. Double authentification de l'équipe (réglage security.requireAdminMfa)
-- ---------------------------------------------------------------------
create or replace function public.admin_mfa_required()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (s.data -> 'security' ->> 'requireAdminMfa')::boolean from public.app_settings s where s.id = 1), false);
$$;

-- La session de l'admin connecté doit être en aal2 quand le réglage est actif
create or replace function public.admin_session_ok(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is distinct from auth.uid()
      or not public.admin_mfa_required()
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and exists (select 1 from public.user_roles r where r.user_id = uid)
     and public.admin_session_ok(uid);
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
  ) and public.admin_session_ok(uid);
$$;

-- ---------------------------------------------------------------------
-- A. Annonces
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  level text not null default 'info' check (level in ('info', 'success', 'warning', 'danger')),
  audience text not null default 'all' check (audience in ('all', 'teachers', 'students')),
  plan_id uuid references public.plans(id) on delete cascade,
  link_url text,
  link_label text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists announcements_active_idx on public.announcements (starts_at desc) where is_active;

create table if not exists public.announcement_dismissals (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.announcements enable row level security;
alter table public.announcement_dismissals enable row level security;
grant select, insert, update, delete on public.announcements to authenticated;
grant select, insert, delete on public.announcement_dismissals to authenticated;

-- Annonces visibles par l'utilisateur connecté
create or replace function public.announcement_visible(a public.announcements)
returns boolean language sql stable security definer set search_path = '' as $$
  select a.is_active and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())
    and (
      a.audience = 'all'
      or (a.audience = 'teachers' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'professor'))
      or (a.audience = 'students' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student'))
    )
    and (a.plan_id is null or exists (select 1 from public.subscription_status(auth.uid()) s where s.plan_id = a.plan_id));
$$;

drop policy if exists "annonces lecture" on public.announcements;
create policy "annonces lecture" on public.announcements for select to authenticated
  using (public.announcement_visible(announcements) or public.has_admin_permission('admin.settings.manage'));
drop policy if exists "annonces gestion" on public.announcements;
create policy "annonces gestion" on public.announcements for all to authenticated
  using (public.has_admin_permission('admin.settings.manage'))
  with check (public.has_admin_permission('admin.settings.manage'));

drop policy if exists "annonces masquees" on public.announcement_dismissals;
create policy "annonces masquees" on public.announcement_dismissals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- E. Remboursements (avant les statistiques qui les excluent)
-- ---------------------------------------------------------------------
alter table public.payments
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_reason text,
  add column if not exists discount_mad numeric(10, 2),
  add column if not exists promo_code text;

-- ---------------------------------------------------------------------
-- B. Statistiques du tableau de bord
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration' using errcode = '42501';
  end if;
  with months as (
    select generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month')::date as m
  ),
  teachers as (
    select p.id, p.name, u.last_sign_in_at
    from public.profiles p left join auth.users u on u.id = p.id
    where p.role = 'professor'
  ),
  ended as (
    -- abonnements payants arrivés à échéance ces 12 derniers mois
    select s.id, s.teacher_id, s.ends_at from public.subscriptions s
    where s.kind = 'paid' and s.ends_at between now() - interval '12 months' and now()
  )
  select jsonb_build_object(
    'revenue_months', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m.m, 'YYYY-MM'), 'amount', coalesce(x.amount, 0), 'count', coalesce(x.n, 0)) order by m.m), '[]'::jsonb)
      from months m
      left join (
        select date_trunc('month', p.paid_at)::date as m, sum(p.amount_mad) as amount, count(*) as n
        from public.payments p where p.refunded_at is null group by 1
      ) x on x.m = m.m
    ),
    'new_teachers_months', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m.m, 'YYYY-MM'), 'count', coalesce(x.n, 0)) order by m.m), '[]'::jsonb)
      from months m
      left join (select date_trunc('month', p.created_at)::date as m, count(*) as n from public.profiles p where p.role = 'professor' group by 1) x on x.m = m.m
    ),
    'active_7', (select count(*) from teachers t where t.last_sign_in_at > now() - interval '7 days'),
    'active_30', (select count(*) from teachers t where t.last_sign_in_at > now() - interval '30 days'),
    'inactive_30', (select count(*) from teachers t where t.last_sign_in_at is null or t.last_sign_in_at <= now() - interval '30 days'),
    'renewal_rate', (
      select case when count(*) = 0 then null else round(100.0 * count(*) filter (where exists (
        select 1 from public.subscriptions n where n.teacher_id = e.teacher_id and n.kind = 'paid' and n.id <> e.id
          and n.starts_at >= e.ends_at - interval '30 days' and n.canceled_at is null)) / count(*)) end
      from ended e
    ),
    'by_method', (
      select coalesce(jsonb_agg(jsonb_build_object('method', x.method, 'amount', x.amount, 'count', x.n) order by x.amount desc), '[]'::jsonb)
      from (select p.method, sum(p.amount_mad) as amount, count(*) as n from public.payments p
            where p.refunded_at is null and p.paid_at >= date_trunc('year', now())::date group by 1) x
    ),
    'ai_months', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m.m, 'YYYY-MM'), 'calls', coalesce(x.n, 0), 'tokens', coalesce(x.tokens, 0)) order by m.m), '[]'::jsonb)
      from months m
      left join (select date_trunc('month', a.created_at)::date as m, count(*) as n,
                        sum(coalesce(a.input_tokens, 0) + coalesce(a.output_tokens, 0)) as tokens
                 from public.ai_usage a group by 1) x on x.m = m.m
    ),
    'ai_kinds', (
      select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'calls', x.n) order by x.n desc), '[]'::jsonb)
      from (select a.kind, count(*) as n from public.ai_usage a where a.created_at >= date_trunc('month', now()) group by 1) x
    ),
    'ai_top', (
      select coalesce(jsonb_agg(jsonb_build_object('teacher_id', x.user_id, 'name', x.name, 'calls', x.n, 'tokens', x.tokens) order by x.n desc), '[]'::jsonb)
      from (select a.user_id, coalesce(p.name, '—') as name, count(*) as n,
                   sum(coalesce(a.input_tokens, 0) + coalesce(a.output_tokens, 0)) as tokens
            from public.ai_usage a left join public.profiles p on p.id = a.user_id
            where a.created_at >= date_trunc('month', now())
            group by 1, 2 order by count(*) desc limit 10) x
    )
  ) into v;
  return v;
end;
$$;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- ---------------------------------------------------------------------
-- C. Notes internes sur un professeur
-- ---------------------------------------------------------------------
create table if not exists public.teacher_notes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  pinned boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists teacher_notes_teacher_idx on public.teacher_notes (teacher_id, created_at desc);
alter table public.teacher_notes enable row level security;
grant select, insert, update, delete on public.teacher_notes to authenticated;
drop policy if exists "notes admin" on public.teacher_notes;
create policy "notes admin" on public.teacher_notes for all to authenticated
  using (public.has_admin_permission('admin.teachers.manage'))
  with check (public.has_admin_permission('admin.teachers.manage'));

-- ---------------------------------------------------------------------
-- D. Codes promo et parrainage
-- ---------------------------------------------------------------------
create table if not exists public.promo_codes (
  code text primary key check (code = upper(code) and length(code) between 3 and 32),
  kind text not null default 'percent' check (kind in ('percent', 'amount', 'days')),
  value numeric(10, 2) not null check (value > 0),
  plan_id uuid references public.plans(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,  -- code de parrainage d'un prof
  referral_bonus_days int,                                    -- jours offerts au parrain
  max_uses int,
  used_count int not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  description text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
grant select, insert, update, delete on public.promo_codes to authenticated;
drop policy if exists "promo admin" on public.promo_codes;
create policy "promo admin" on public.promo_codes for all to authenticated
  using (public.has_admin_permission('admin.plans.manage') or owner_id = auth.uid())
  with check (public.has_admin_permission('admin.plans.manage'));

alter table public.subscription_requests
  add column if not exists promo_code text,
  add column if not exists discount_mad numeric(10, 2);

-- Vérifie un code pour une offre : renvoie la remise (sans l'utiliser)
create or replace function public.check_promo_code(p_code text, p_plan uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c public.promo_codes%rowtype;
  pl public.plans%rowtype;
  v_discount numeric(10, 2) := 0;
begin
  select * into c from public.promo_codes where code = upper(trim(coalesce(p_code, '')));
  if not found or not c.is_active or (c.expires_at is not null and c.expires_at < now())
     or (c.max_uses is not null and c.used_count >= c.max_uses) then
    return jsonb_build_object('valid', false, 'reason', 'invalid');
  end if;
  if c.owner_id = auth.uid() then
    return jsonb_build_object('valid', false, 'reason', 'own_code');
  end if;
  if c.plan_id is not null and c.plan_id is distinct from p_plan then
    return jsonb_build_object('valid', false, 'reason', 'other_plan');
  end if;
  select * into pl from public.plans where id = p_plan;
  if c.kind = 'percent' then
    v_discount := round(coalesce(pl.price_mad, 0) * least(c.value, 100) / 100, 2);
  elsif c.kind = 'amount' then
    v_discount := least(c.value, coalesce(pl.price_mad, 0));
  end if;
  return jsonb_build_object('valid', true, 'code', c.code, 'kind', c.kind, 'value', c.value,
                            'discount_mad', v_discount, 'bonus_days', case when c.kind = 'days' then c.value::int else 0 end,
                            'price_mad', greatest(coalesce(pl.price_mad, 0) - v_discount, 0),
                            'referral', c.owner_id is not null);
end;
$$;
revoke execute on function public.check_promo_code(text, uuid) from public, anon;
grant execute on function public.check_promo_code(text, uuid) to authenticated;

-- Code de parrainage du prof connecté (créé à la première demande)
create or replace function public.my_referral_code()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_days int := coalesce((select (s.data -> 'payments' ->> 'referralBonusDays')::int from public.app_settings s where s.id = 1), 30);
  v_off numeric := coalesce((select (s.data -> 'payments' ->> 'referralDiscountPct')::numeric from public.app_settings s where s.id = 1), 10);
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'professor') then
    return null;
  end if;
  select code into v_code from public.promo_codes where owner_id = auth.uid() limit 1;
  if v_code is null then
    loop
      v_code := 'P' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
      exit when not exists (select 1 from public.promo_codes where code = v_code);
    end loop;
    insert into public.promo_codes (code, kind, value, owner_id, referral_bonus_days, description, created_by)
    values (v_code, 'percent', greatest(v_off, 1), auth.uid(), v_days, 'Parrainage', auth.uid());
  end if;
  return v_code;
end;
$$;
revoke execute on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated;

-- Filleuls du prof connecté
create or replace function public.my_referrals()
returns table (name text, created_at timestamptz, rewarded boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(p.name, '—')::text, r.created_at, r.status = 'done'
  from public.subscription_requests r
  join public.promo_codes c on c.code = r.promo_code and c.owner_id = auth.uid()
  left join public.profiles p on p.id = r.teacher_id
  where r.status in ('pending', 'done')
  order by r.created_at desc;
$$;
revoke execute on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;

-- Validation d'un paiement (remplace la version de 20261029120000) : + code promo / parrainage
create or replace function public.admin_approve_subscription_request(
  p_request uuid,
  p_amount numeric default null,
  p_paid_at date default null,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.subscription_requests%rowtype;
  cur public.subscriptions%rowtype;
  pl public.plans%rowtype;
  c public.promo_codes%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_amount numeric(10, 2);
  v_discount numeric(10, 2) := 0;
  v_bonus int := 0;
  v_sub uuid;
  v_pay uuid;
  v_receipt text;
  v_ref_sub public.subscriptions%rowtype;
begin
  if not (public.has_admin_permission('admin.subscriptions.manage')
          and public.has_admin_permission('admin.payments.manage')) then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;

  select * into r from public.subscription_requests where id = p_request for update;
  if not found then
    raise exception 'Demande introuvable';
  end if;
  if r.status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée';
  end if;

  select sub.* into cur
  from public.subscriptions sub
  where sub.teacher_id = r.teacher_id and sub.starts_at <= now() and sub.canceled_at is null
    and (sub.ends_at is null or sub.ends_at > now())
  order by (sub.ends_at is null) desc, sub.ends_at desc
  limit 1;

  select * into pl from public.plans where id = coalesce(r.plan_id, cur.plan_id);
  if not found then
    raise exception 'Aucune offre choisie';
  end if;

  -- code promo : vérifié de nouveau au moment de la validation
  if r.promo_code is not null then
    select * into c from public.promo_codes where code = r.promo_code for update;
    if found and c.is_active and (c.expires_at is null or c.expires_at > now())
       and (c.max_uses is null or c.used_count < c.max_uses)
       and (c.plan_id is null or c.plan_id = pl.id)
       and c.owner_id is distinct from r.teacher_id then
      if c.kind = 'percent' then v_discount := round(coalesce(pl.price_mad, 0) * least(c.value, 100) / 100, 2);
      elsif c.kind = 'amount' then v_discount := least(c.value, coalesce(pl.price_mad, 0));
      else v_bonus := c.value::int;
      end if;
      update public.promo_codes set used_count = used_count + 1 where code = c.code;
    else
      c := null;
    end if;
  end if;

  if cur.id is not null and cur.plan_id = pl.id and cur.ends_at is not null then
    select greatest(cur.ends_at, coalesce(max(x.ends_at), cur.ends_at)) into v_start
    from public.subscriptions x
    where x.teacher_id = r.teacher_id and x.plan_id = pl.id and x.canceled_at is null and x.starts_at > now();
  else
    v_start := now();
    update public.subscriptions set canceled_at = now()
    where teacher_id = r.teacher_id and canceled_at is null and (ends_at is null or ends_at > now());
  end if;
  v_end := case when pl.duration_days is null then null
                else v_start + make_interval(days => pl.duration_days + v_bonus) end;
  v_amount := coalesce(p_amount, r.amount_mad, greatest(coalesce(pl.price_mad, 0) - v_discount, 0), 0);

  insert into public.subscriptions (teacher_id, plan_id, kind, starts_at, ends_at, grace_days, price_mad, notes, created_by)
  values (r.teacher_id, pl.id, 'paid', v_start, v_end, pl.grace_days, v_amount,
          coalesce(nullif(p_notes, ''), 'Paiement validé (demande du professeur)')
            || case when c.code is not null then ' · code ' || c.code else '' end, auth.uid())
  returning id into v_sub;

  v_receipt := 'R' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.payment_receipt_seq')::text, 5, '0');
  if v_amount > 0 then
    insert into public.payments (teacher_id, subscription_id, amount_mad, paid_at, method, reference, receipt_number, notes,
                                 discount_mad, promo_code, created_by)
    values (r.teacher_id, v_sub, v_amount, coalesce(p_paid_at, r.paid_on, current_date),
            coalesce(r.pay_method, 'transfer'), r.pay_reference, v_receipt, nullif(p_notes, ''),
            nullif(v_discount, 0), c.code, auth.uid())
    returning id into v_pay;
  end if;

  update public.subscription_requests
  set status = 'done', handled_by = auth.uid(), handled_at = now(), subscription_id = v_sub, payment_id = v_pay,
      amount_mad = v_amount, discount_mad = nullif(v_discount, 0)
  where id = r.id;

  -- parrainage : le parrain gagne des jours sur son abonnement en cours (1re validation du filleul)
  if c.owner_id is not null and coalesce(c.referral_bonus_days, 0) > 0
     and not exists (select 1 from public.subscription_requests x
                     where x.teacher_id = r.teacher_id and x.status = 'done' and x.id <> r.id and x.promo_code = c.code) then
    select s.* into v_ref_sub from public.subscriptions s
    where s.teacher_id = c.owner_id and s.canceled_at is null and s.ends_at is not null and s.ends_at > now()
    order by s.ends_at desc limit 1;
    if v_ref_sub.id is not null then
      update public.subscriptions set ends_at = ends_at + make_interval(days => c.referral_bonus_days),
        notes = coalesce(notes || ' · ', '') || 'Parrainage +' || c.referral_bonus_days || ' j'
      where id = v_ref_sub.id;
    end if;
    insert into public.notifications (user_id, title, message, type)
    values (c.owner_id, 'Parrainage', 'Un professeur que vous avez parrainé vient de s''abonner : '
            || c.referral_bonus_days || ' jours offerts' || case when v_ref_sub.id is null then ' : contactez l''administration pour les ajouter à votre prochain abonnement.' else ' sur votre abonnement en cours.' end,
            'info');
  end if;

  return jsonb_build_object('subscription_id', v_sub, 'payment_id', v_pay,
                            'receipt_number', case when v_pay is null then null else v_receipt end,
                            'starts_at', v_start, 'ends_at', v_end, 'discount_mad', v_discount, 'bonus_days', v_bonus);
end;
$$;
revoke execute on function public.admin_approve_subscription_request(uuid, numeric, date, text) from public, anon;
grant execute on function public.admin_approve_subscription_request(uuid, numeric, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- F. Relances avant la fin d'un abonnement
-- ---------------------------------------------------------------------
create table if not exists public.renewal_reminders (
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  kind text not null check (kind in ('d7', 'd1', 'grace_end')),
  sent_at timestamptz not null default now(),
  primary key (subscription_id, kind)
);
alter table public.renewal_reminders enable row level security;
grant select on public.renewal_reminders to authenticated;
drop policy if exists "relances admin" on public.renewal_reminders;
create policy "relances admin" on public.renewal_reminders for select to authenticated
  using (public.has_admin_permission('admin.subscriptions.manage'));

-- Envoie les relances dues (notification dans l'application). Renvoie le nombre envoyé.
create or replace function public.send_renewal_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  s record;
  n int := 0;
  v_kind text;
  v_title text;
  v_msg text;
begin
  -- appel manuel : admin ; appel planifié (pg_cron) : pas d'utilisateur
  if auth.uid() is not null and not public.has_admin_permission('admin.subscriptions.manage') then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  for s in
    select sub.id, sub.teacher_id, sub.ends_at, sub.grace_days, pl.name as plan_name
    from public.subscriptions sub join public.plans pl on pl.id = sub.plan_id
    where sub.canceled_at is null and sub.ends_at is not null
      and sub.ends_at between now() - make_interval(days => sub.grace_days) - interval '1 day' and now() + interval '7 days'
      -- pas de relance si un abonnement suivant est déjà prévu
      and not exists (select 1 from public.subscriptions nx where nx.teacher_id = sub.teacher_id and nx.canceled_at is null
                      and nx.id <> sub.id and nx.starts_at >= sub.ends_at - interval '1 day')
  loop
    v_kind := case
      when s.ends_at <= now() and s.ends_at + make_interval(days => s.grace_days) <= now() + interval '1 day' then 'grace_end'
      when s.ends_at > now() and s.ends_at <= now() + interval '1 day' then 'd1'
      when s.ends_at > now() + interval '1 day' and s.ends_at <= now() + interval '7 days' then 'd7'
      else null end;
    continue when v_kind is null;
    continue when exists (select 1 from public.renewal_reminders rr where rr.subscription_id = s.id and rr.kind = v_kind);
    v_title := case v_kind when 'd7' then 'Votre abonnement se termine bientôt'
                           when 'd1' then 'Votre abonnement se termine demain'
                           else 'Dernier jour de la période de grâce' end;
    v_msg := 'Offre ' || s.plan_name || ' : fin le ' || to_char(s.ends_at at time zone 'Africa/Casablanca', 'DD/MM/YYYY')
             || '. Renouvelez depuis « Mon abonnement » pour garder l''accès à toutes vos fonctions.';
    insert into public.notifications (user_id, title, message, type) values (s.teacher_id, v_title, v_msg, 'warning');
    insert into public.renewal_reminders (subscription_id, kind) values (s.id, v_kind);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.send_renewal_reminders() from public, anon;
grant execute on function public.send_renewal_reminders() to authenticated;

-- Planification quotidienne (8 h) si l'extension pg_cron est activée dans Supabase
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'renewal-reminders';
    perform cron.schedule('renewal-reminders', '0 8 * * *', 'select public.send_renewal_reminders()');
  else
    raise notice 'pg_cron absent : relances à lancer depuis l''administration (Abonnements > Envoyer les relances)';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- G. Activité d'un professeur
-- ---------------------------------------------------------------------
create or replace function public.admin_teacher_activity(p_teacher uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'classes', (select count(*) from public.rooms r where r.professor_id = p_teacher),
    'students', (select count(distinct x.id) from (
        select p.id from public.profiles p join public.rooms r on r.id = p.room_id where r.professor_id = p_teacher and p.role = 'student'
        union select e.student_id from public.enrollments e join public.rooms r on r.id = e.room_id where r.professor_id = p_teacher) x),
    'courses', (select count(*) from public.courses c where c.professor_id = p_teacher),
    'exercises', (select count(*) from public.exercises e join public.courses c on c.id = e.course_id where c.professor_id = p_teacher),
    'quizzes', (select count(*) from public.exams e join public.courses c on c.id = e.course_id where c.professor_id = p_teacher),
    'submissions_30', (select count(*) from public.quiz_submissions s join public.exams e on e.id = s.exam_id
                       join public.courses c on c.id = e.course_id where c.professor_id = p_teacher and s.submitted_at > now() - interval '30 days'),
    'ai_month', (select count(*) from public.ai_usage a where a.user_id = p_teacher and a.created_at >= date_trunc('month', now())),
    'ai_tokens_month', (select coalesce(sum(coalesce(a.input_tokens, 0) + coalesce(a.output_tokens, 0)), 0) from public.ai_usage a
                        where a.user_id = p_teacher and a.created_at >= date_trunc('month', now())),
    'last_course_at', (select max(c.created_at) from public.courses c where c.professor_id = p_teacher),
    'rooms', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name,
                'students', (select count(*) from public.profiles p where p.room_id = r.id and p.role = 'student'),
                'courses', (select count(*) from public.courses c where c.room_id = r.id)) order by r.created_at desc), '[]'::jsonb)
              from public.rooms r where r.professor_id = p_teacher)
  ) into v;
  return v;
end;
$$;
revoke execute on function public.admin_teacher_activity(uuid) from public, anon;
grant execute on function public.admin_teacher_activity(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- H. Offres : visibles ou sur invitation, prix barré
-- ---------------------------------------------------------------------
alter table public.plans
  add column if not exists is_public boolean not null default true,
  add column if not exists compare_at_mad numeric(10, 2);

-- ---------------------------------------------------------------------
-- I. Historique de la personnalisation
-- ---------------------------------------------------------------------
create table if not exists public.app_settings_history (
  id bigserial primary key,
  data jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by uuid
);
alter table public.app_settings_history enable row level security;
grant select on public.app_settings_history to authenticated;
drop policy if exists "historique reglages" on public.app_settings_history;
create policy "historique reglages" on public.app_settings_history for select to authenticated
  using (public.has_admin_permission('admin.settings.manage'));

create or replace function public.app_settings_keep_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.data is distinct from new.data then
    insert into public.app_settings_history (data, saved_at, saved_by) values (old.data, old.updated_at, old.updated_by);
    -- on garde les 50 dernières versions
    delete from public.app_settings_history h
    where h.id not in (select id from public.app_settings_history order by id desc limit 50);
  end if;
  return new;
end;
$$;
drop trigger if exists app_settings_keep_history on public.app_settings;
create trigger app_settings_keep_history before update on public.app_settings
  for each row execute function public.app_settings_keep_history();

-- ---------------------------------------------------------------------
-- Journal d'audit et temps réel
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.audit_trigger()') is not null then
    execute 'drop trigger if exists audit_promo_codes on public.promo_codes';
    execute 'create trigger audit_promo_codes after insert or update or delete on public.promo_codes for each row execute function public.audit_trigger()';
    execute 'drop trigger if exists audit_announcements on public.announcements';
    execute 'create trigger audit_announcements after insert or update or delete on public.announcements for each row execute function public.audit_trigger()';
  end if;
  begin
    execute 'alter publication supabase_realtime add table public.announcements';
  exception when duplicate_object then null;
  when undefined_object then raise notice 'publication supabase_realtime absente';
  end;
end $$;
