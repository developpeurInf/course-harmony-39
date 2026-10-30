-- =====================================================================
-- Paiement des abonnements par les professeurs
--
-- * Le prof choisit une offre, paie (virement, CashPlus / Wafacash…) et
--   envoie la photo ou le PDF de son reçu : une demande « pending ».
-- * L'administration ouvre le reçu puis :
--     - valide  → admin_approve_subscription_request : nouvel abonnement
--                 payant + paiement enregistré (numéro de reçu automatique) ;
--     - refuse  → admin_reject_subscription_request (motif visible du prof).
-- * Reçus : bucket privé « payment-receipts », dossier = id du prof.
-- * Coordonnées de paiement (RIB, CashPlus…) : app_settings.data.payments.
-- * À exécuter à la main dans le SQL Editor. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Demandes : informations de paiement
-- ---------------------------------------------------------------------
alter table public.subscription_requests
  add column if not exists amount_mad numeric(10, 2),
  add column if not exists pay_method text,
  add column if not exists pay_reference text,
  add column if not exists paid_on date,
  add column if not exists receipt_path text,
  add column if not exists reject_reason text,
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists payment_id uuid references public.payments(id) on delete set null;

alter table public.subscription_requests drop constraint if exists subscription_requests_status_check;
alter table public.subscription_requests add constraint subscription_requests_status_check
  check (status in ('pending', 'done', 'rejected', 'canceled'));

alter table public.subscription_requests drop constraint if exists subscription_requests_pay_method_check;
alter table public.subscription_requests add constraint subscription_requests_pay_method_check
  check (pay_method is null or pay_method in ('cash', 'transfer', 'card', 'mobile', 'agency', 'check', 'other'));

create index if not exists subscription_requests_pending_idx
  on public.subscription_requests (created_at) where status = 'pending';

-- Le prof crée sa demande (sans champs de traitement) et peut l'annuler tant qu'elle attend
drop policy if exists "demandes creation" on public.subscription_requests;
create policy "demandes creation" on public.subscription_requests for insert to authenticated
  with check (
    teacher_id = auth.uid() and status = 'pending'
    and handled_by is null and handled_at is null and reject_reason is null
    and subscription_id is null and payment_id is null
    and (receipt_path is null or split_part(receipt_path, '/', 1) = auth.uid()::text)
  );

drop policy if exists "demandes annulation" on public.subscription_requests;
create policy "demandes annulation" on public.subscription_requests for update to authenticated
  using (teacher_id = auth.uid() and status = 'pending')
  with check (teacher_id = auth.uid() and status = 'canceled' and subscription_id is null and payment_id is null);

-- ---------------------------------------------------------------------
-- 2. Paiements : moyen « agence » (CashPlus, Wafacash…) + numéro de reçu
-- ---------------------------------------------------------------------
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('cash', 'transfer', 'card', 'mobile', 'agency', 'check', 'other'));

create sequence if not exists public.payment_receipt_seq;

-- ---------------------------------------------------------------------
-- 3. Reçus envoyés par les profs (bucket privé)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "recus depot prof" on storage.objects;
create policy "recus depot prof" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "recus lecture" on storage.objects;
create policy "recus lecture" on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text
         or public.has_admin_permission('admin.subscriptions.manage')
         or public.has_admin_permission('admin.payments.manage'))
  );

-- ---------------------------------------------------------------------
-- 4. Validation : abonnement + paiement en une seule opération
-- ---------------------------------------------------------------------
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
  v_start timestamptz;
  v_end timestamptz;
  v_amount numeric(10, 2);
  v_sub uuid;
  v_pay uuid;
  v_receipt text;
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

  -- abonnement en cours (même règle que current_subscription)
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

  if cur.id is not null and cur.plan_id = pl.id and cur.ends_at is not null then
    -- renouvellement : la nouvelle période suit la dernière déjà prévue pour cette offre
    select greatest(cur.ends_at, coalesce(max(x.ends_at), cur.ends_at)) into v_start
    from public.subscriptions x
    where x.teacher_id = r.teacher_id and x.plan_id = pl.id and x.canceled_at is null and x.starts_at > now();
  else
    -- nouvelle offre (ou aucun abonnement en cours) : démarre maintenant,
    -- l'abonnement en cours et ceux déjà prévus s'arrêtent
    v_start := now();
    update public.subscriptions set canceled_at = now()
    where teacher_id = r.teacher_id and canceled_at is null and (ends_at is null or ends_at > now());
  end if;
  v_end := case when pl.duration_days is null then null else v_start + make_interval(days => pl.duration_days) end;
  v_amount := coalesce(p_amount, r.amount_mad, pl.price_mad, 0);

  insert into public.subscriptions (teacher_id, plan_id, kind, starts_at, ends_at, grace_days, price_mad, notes, created_by)
  values (r.teacher_id, pl.id, 'paid', v_start, v_end, pl.grace_days, v_amount,
          coalesce(nullif(p_notes, ''), 'Paiement validé (demande du professeur)'), auth.uid())
  returning id into v_sub;

  v_receipt := 'R' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.payment_receipt_seq')::text, 5, '0');
  if v_amount > 0 then
    insert into public.payments (teacher_id, subscription_id, amount_mad, paid_at, method, reference, receipt_number, notes, created_by)
    values (r.teacher_id, v_sub, v_amount, coalesce(p_paid_at, r.paid_on, current_date),
            coalesce(r.pay_method, 'transfer'), r.pay_reference, v_receipt, nullif(p_notes, ''), auth.uid())
    returning id into v_pay;
  end if;

  update public.subscription_requests
  set status = 'done', handled_by = auth.uid(), handled_at = now(), subscription_id = v_sub, payment_id = v_pay,
      amount_mad = v_amount
  where id = r.id;

  return jsonb_build_object('subscription_id', v_sub, 'payment_id', v_pay,
                            'receipt_number', case when v_pay is null then null else v_receipt end,
                            'starts_at', v_start, 'ends_at', v_end);
end;
$$;

create or replace function public.admin_reject_subscription_request(p_request uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_admin_permission('admin.subscriptions.manage') then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;
  update public.subscription_requests
  set status = 'rejected', reject_reason = nullif(trim(coalesce(p_reason, '')), ''),
      handled_by = auth.uid(), handled_at = now()
  where id = p_request and status = 'pending';
  if not found then
    raise exception 'Demande introuvable ou déjà traitée';
  end if;
end;
$$;

revoke execute on function public.admin_approve_subscription_request(uuid, numeric, date, text) from public, anon;
revoke execute on function public.admin_reject_subscription_request(uuid, text) from public, anon;
grant execute on function public.admin_approve_subscription_request(uuid, numeric, date, text) to authenticated;
grant execute on function public.admin_reject_subscription_request(uuid, text) to authenticated;

-- Journal d'audit des demandes (même déclencheur que les autres tables d'administration)
do $$
begin
  if to_regprocedure('public.audit_trigger()') is not null then
    execute 'drop trigger if exists audit_subscription_requests on public.subscription_requests';
    execute 'create trigger audit_subscription_requests after insert or update or delete on public.subscription_requests for each row execute function public.audit_trigger()';
  end if;
end $$;

-- Temps réel : le prof voit sa demande validée sans recharger
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.subscription_requests';
  exception when duplicate_object then null;
  when undefined_object then raise notice 'publication supabase_realtime absente';
  end;
end $$;
