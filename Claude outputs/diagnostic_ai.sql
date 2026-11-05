-- =====================================================================
-- Évaluation diagnostique : modèles de rapport 3 et 4 + analyse par l'IA
--
--   Habilitations :
--     diagnostic.template3 : « Analyse des acquis et plan de remédiation »
--     diagnostic.template4 : « Groupes de besoin » (listes nominatives)
--     ai.diagnostic        : analyse IA (fonction teacher-ai, action « diagnostic »)
--   Données : rien de nouveau en base (l'analyse est enregistrée dans la configuration du
--   diagnostic, comme les autres textes du rapport). Le journal ai_usage sert de limite
--   quotidienne (30 analyses / jour / professeur).
--
-- À exécuter à la main dans le SQL Editor de Supabase, APRÈS 20261031090000_teacher_ai.sql.
-- Idempotent.
-- =====================================================================
do $$
begin
  if to_regclass('public.permissions') is null then
    raise notice 'table permissions absente : habilitations non ajoutées';
    return;
  end if;

  insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
    ('diagnostic.template3', 'diagnostic', 'Modèle 3 : analyse des acquis et plan de remédiation', 'النموذج 3: تحليل النتائج وخطة الدعم', 'Template 3: analysis and remediation plan', 'feature', true, 311),
    ('diagnostic.template4', 'diagnostic', 'Modèle 4 : groupes de besoin (listes nominatives)', 'النموذج 4: لوائح فئات الدعم', 'Template 4: need-based groups', 'feature', true, 312),
    ('ai.diagnostic', 'diagnostic', 'Analyse de l''évaluation diagnostique par l''IA', 'تحليل التقويم التشخيصي بالذكاء الاصطناعي', 'AI analysis of the diagnostic assessment', 'feature', true, 313)
  on conflict (key) do nothing;

  -- Les offres qui ont le modèle 2 reçoivent les modèles 3, 4 et l'analyse IA
  insert into public.plan_permissions (plan_id, permission_key, limit_value)
  select pp.plan_id, x.k, null
  from public.plan_permissions pp
  cross join (values ('diagnostic.template3'), ('diagnostic.template4'), ('ai.diagnostic')) as x(k)
  where pp.permission_key = 'diagnostic.template2'
    and not exists (select 1 from public.plan_permissions y where y.plan_id = pp.plan_id and y.permission_key = x.k);
end $$;

notify pgrst, 'reload schema';
