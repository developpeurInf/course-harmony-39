-- =====================================================================
-- Performance (novembre 2026)
-- 1. my_access() : calcul en une passe (au lieu de ~90 appels à has_permission,
--    chacun relisant l'abonnement, le compte et les exceptions). Résultat identique.
-- 2. Règles RLS : auth.uid() évalué une seule fois par requête (et non par ligne).
-- 3. Index sur les clés étrangères qui n'en avaient pas.
-- Sans risque : à lancer une fois dans le SQL Editor de Supabase (relançable).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. my_access() en une passe
-- ---------------------------------------------------------------------
create or replace function public.my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  v_role record;
  v_sub record;
  v_account record;
  v_is_admin boolean;
  v_blocked boolean;
  v_perms jsonb;
  v_quotas jsonb;
begin
  if uid is null then
    return null;
  end if;
  select r.role, r.admin_permissions into v_role from public.user_roles r where r.user_id = uid;
  select * into v_sub from public.subscription_status(uid);
  select ta.status, ta.must_change_password into v_account from public.teacher_accounts ta where ta.user_id = uid;
  v_is_admin := public.is_admin(uid);
  v_blocked := coalesce(v_account.status in ('suspended', 'deleted'), false);

  -- Même logique que has_permission(), mais lue une seule fois pour toutes les fonctions
  select coalesce(jsonb_agg(p.key order by p.sort_order), '[]'::jsonb) into v_perms
  from public.permissions p
  left join public.teacher_permission_overrides o
    on o.teacher_id = uid and o.permission_key = p.key and (o.expires_at is null or o.expires_at > now())
  where p.kind = 'feature'
    and (
      v_is_admin
      or (
        not v_blocked
        and o.effect is distinct from 'deny'
        and (
          o.effect = 'allow'
          or (
            v_sub.status is not null and v_sub.status not in ('none', 'suspended')
            and case
              when v_sub.status = 'expired' then
                not coalesce(p.is_write, true)
                and exists (
                  select 1 from public.plan_permissions pp
                  join public.subscriptions sub on sub.plan_id = pp.plan_id
                  where sub.teacher_id = uid and pp.permission_key = p.key)
              else
                exists (select 1 from public.plan_permissions pp where pp.plan_id = v_sub.plan_id and pp.permission_key = p.key)
            end
          )
        )
      )
    );

  -- Même logique que quota_limit() / quota_usage()
  select coalesce(jsonb_object_agg(p.key, jsonb_build_object(
           'limit', case
              when v_is_admin then null
              when o.permission_key is not null then o.limit_value
              when v_sub.plan_id is null then null
              else (select pp.limit_value from public.plan_permissions pp where pp.plan_id = v_sub.plan_id and pp.permission_key = p.key)
            end,
           'used', public.quota_usage(p.key, uid))), '{}'::jsonb) into v_quotas
  from public.permissions p
  left join public.teacher_permission_overrides o
    on o.teacher_id = uid and o.permission_key = p.key and o.effect = 'allow'
   and (o.expires_at is null or o.expires_at > now())
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
$function$;

grant execute on function public.my_access() to authenticated;

-- ---------------------------------------------------------------------
-- 2. RLS : auth.uid() / auth.jwt() / auth.role() évalués une fois par requête
--    (recommandation officielle Supabase : « (select auth.uid()) »).
--    Le sens des règles ne change pas : seule la façon de les évaluer change.
-- ---------------------------------------------------------------------
do $$
declare
  p record;
  v_qual text;
  v_check text;
  v_sql text;
  -- forme déjà optimisée (telle que PostgreSQL la réécrit) → jeton temporaire
  fn text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ 'auth\.(uid|jwt|role)\(\)' or coalesce(with_check, '') ~ 'auth\.(uid|jwt|role)\(\)')
  loop
    v_qual := p.qual;
    v_check := p.with_check;
    foreach fn in array array['uid', 'jwt', 'role'] loop
      if v_qual is not null then
        v_qual := replace(v_qual, format('( SELECT auth.%s() AS %s)', fn, fn), format('@@%s@@', fn));
        v_qual := replace(v_qual, format('auth.%s()', fn), format('@@%s@@', fn));
        v_qual := replace(v_qual, format('@@%s@@', fn), format('(select auth.%s())', fn));
      end if;
      if v_check is not null then
        v_check := replace(v_check, format('( SELECT auth.%s() AS %s)', fn, fn), format('@@%s@@', fn));
        v_check := replace(v_check, format('auth.%s()', fn), format('@@%s@@', fn));
        v_check := replace(v_check, format('@@%s@@', fn), format('(select auth.%s())', fn));
      end if;
    end loop;
    if v_qual is not distinct from p.qual and v_check is not distinct from p.with_check then
      continue;
    end if;
    v_sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then v_sql := v_sql || format(' using (%s)', v_qual); end if;
    if p.with_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    execute v_sql;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Index manquants sur les clés étrangères (jointures, suppressions en cascade, RLS)
-- ---------------------------------------------------------------------
do $$
declare
  c record;
  v_cols text;
  v_name text;
begin
  for c in
    select con.conrelid, con.conname, con.conkey, cl.relname
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where con.contype = 'f' and n.nspname = 'public'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = con.conrelid
          and (i.indkey::int2[])[0:array_length(con.conkey, 1) - 1] @> con.conkey
          and (i.indkey::int2[])[0:array_length(con.conkey, 1) - 1] <@ con.conkey
      )
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord) into v_cols
    from unnest(c.conkey) with ordinality as k(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum;
    v_name := left(c.relname || '_' || replace(replace(v_cols, '"', ''), ', ', '_') || '_fk_idx', 63);
    execute format('create index if not exists %I on public.%I (%s)', v_name, c.relname, v_cols);
  end loop;
end $$;

-- Statistiques à jour pour le planificateur
analyze;

-- ---------------------------------------------------------------------
-- 4. chat_contacts() (Messages) : les droits du professeur (chat / appels) sont lus
--    une fois, et non deux fois par élève. Corrige la fonction en place, sans rien
--    changer d'autre (ignoré si elle a déjà été corrigée ou modifiée).
-- ---------------------------------------------------------------------
do $$
declare d text;
begin
  if to_regprocedure('public.chat_contacts()') is null then return; end if;
  d := pg_get_functiondef('public.chat_contacts()'::regprocedure);
  if position('v_chat_on' in d) > 0
     or position($x$public.has_permission('chat.students', v_me) and a.rooms is not null$x$ in d) = 0 then
    return;
  end if;
  d := regexp_replace(d, 'declare\s+v_me uuid := auth\.uid\(\);\s*v_role text;',
                      'declare v_me uuid := auth.uid(); v_role text; v_chat_on boolean; v_calls_on boolean;');
  d := regexp_replace(d, 'else(\s+)return query(\s+)with st as',
                      E'else\\1v_chat_on := public.has_permission(''chat.students'', v_me);\\1v_calls_on := public.has_permission(''chat.calls'', v_me);\\1return query\\2with st as');
  d := replace(d, $x$public.has_permission('chat.students', v_me) and a.rooms is not null$x$, 'v_chat_on and a.rooms is not null');
  d := replace(d, $x$public.has_permission('chat.calls', v_me) and a.rooms is not null$x$, 'v_calls_on and a.rooms is not null');
  execute d;
end $$;

-- ---------------------------------------------------------------------
-- 5. Tableau de bord (« Cette semaine ») : la vérification de colonne passait par
--    information_schema (lent) ; même test via le catalogue.
-- ---------------------------------------------------------------------
do $$
declare d text;
begin
  if to_regprocedure('public.teacher_week_counts(uuid)') is null then return; end if;
  d := pg_get_functiondef('public.teacher_week_counts(uuid)'::regprocedure);
  if position('information_schema.columns' in d) = 0 then return; end if;
  d := regexp_replace(d,
    'exists\s*\(\s*select 1 from information_schema\.columns\s+where table_schema = ''public'' and table_name = ''quiz_answers'' and column_name = ''graded_at''\s*\)',
    'exists (select 1 from pg_catalog.pg_attribute where attrelid = to_regclass(''public.quiz_answers'') and attname = ''graded_at'' and not attisdropped)');
  execute d;
end $$;
