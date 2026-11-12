-- =====================================================================
-- Outils IA pour les professeurs (lot 3 des propositions)
--
--   A. ai_usage : journal des générations (limite quotidienne dans la fonction teacher-ai).
--   B. lesson_plans : fiches pédagogiques enregistrées par le professeur.
--   C. record_paper_submission() : copie papier d'un QCM (lue sur photo par l'IA, vérifiée
--      par le professeur) enregistrée et corrigée comme une copie en ligne.
--   D. Habilitations « ai.quiz_generator », « ai.lesson_plan » et « ai.omr » (src/lib/permissions.ts).
--
-- La fonction Edge supabase/functions/teacher-ai doit être déployée et le secret
-- ANTHROPIC_API_KEY défini (déjà utilisé par translate-text).
-- À exécuter à la main dans le SQL Editor de Supabase, APRÈS 20261030090000_teaching_tools.sql
-- (utilise in_room). Idempotent.
-- =====================================================================

-- A. Journal d'utilisation (écrit par la fonction avec la clé service)
create table if not exists public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null,
  input_tokens  int,
  output_tokens int,
  created_at    timestamptz not null default now()
);
create index if not exists idx_ai_usage_user on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;
grant select on public.ai_usage to authenticated;
drop policy if exists "AI usage readable by owner" on public.ai_usage;
create policy "AI usage readable by owner" on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin(auth.uid()));

-- B. Fiches pédagogiques
create table if not exists public.lesson_plans (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null,
  level      text,
  language   text not null default 'fr',
  content    jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lesson_plans_owner on public.lesson_plans (owner_id, created_at desc);
alter table public.lesson_plans enable row level security;
grant select, insert, update, delete on public.lesson_plans to authenticated;
drop policy if exists "Lesson plans owner" on public.lesson_plans;
create policy "Lesson plans owner" on public.lesson_plans
  for all to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin(auth.uid()))
  with check (owner_id = (select auth.uid()) and public.is_professor(auth.uid()));

-- C. Copies papier
-- p_answers : [{ "question_id": uuid, "selected_option_ids": [uuid, …] }]
-- Les réponses rédigées restent vides (à corriger à part). Une nouvelle lecture du même
-- élève remplace sa copie papier précédente (repérée par anti_cheat_log = [{"type":"paper"}]).
create or replace function public.record_paper_submission(p_exam_id uuid, p_student_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room uuid;
  v_prof uuid;
  q record;
  v_ans jsonb;
  v_sel uuid[];
  v_correct uuid[];
  v_points int;
  v_ok boolean;
  v_score numeric := 0;
  v_total int := 0;
  v_sub uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  select c.room_id, c.professor_id into v_room, v_prof
  from public.exams e join public.courses c on c.id = e.course_id
  where e.id = p_exam_id;
  if v_prof is null or (v_prof <> v_uid and not public.is_admin(v_uid)) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if public.is_professor(v_uid) and not public.has_permission('ai.omr', v_uid) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not public.in_room(v_room, p_student_id) then
    raise exception 'STUDENT_NOT_IN_CLASS' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_ANSWERS' using errcode = '22023';
  end if;

  delete from public.quiz_submissions s
  where s.exam_id = p_exam_id and s.student_id = p_student_id
    and s.anti_cheat_log @> '[{"type": "paper"}]'::jsonb;

  insert into public.quiz_submissions (exam_id, student_id, score, total_points, is_completed, submitted_at, time_taken_minutes, anti_cheat_events, anti_cheat_log)
  values (p_exam_id, p_student_id, 0, 0, true, now(), null, 0, '[{"type": "paper"}]'::jsonb)
  returning id into v_sub;

  for q in
    select qq.id, qq.question_type, qq.points from public.quiz_questions qq
    where qq.exam_id = p_exam_id order by qq.question_order nulls last, qq.id
  loop
    v_points := coalesce(nullif(q.points, 0), 1);
    v_total := v_total + v_points;
    if q.question_type = 'short_answer' then
      insert into public.quiz_answers (submission_id, question_id, is_correct, points_earned) values (v_sub, q.id, false, 0);
      continue;
    end if;
    select a.value into v_ans from jsonb_array_elements(p_answers) a
    where jsonb_typeof(a.value) = 'object' and a.value ->> 'question_id' = q.id::text limit 1;
    select coalesce(array_agg(o.id order by o.option_order), '{}') into v_sel
    from public.quiz_options o
    where o.question_id = q.id
      and o.id::text in (select jsonb_array_elements_text(case when jsonb_typeof(v_ans -> 'selected_option_ids') = 'array' then v_ans -> 'selected_option_ids' else '[]'::jsonb end));
    select coalesce(array_agg(o.id), '{}') into v_correct from public.quiz_options o where o.question_id = q.id and o.is_correct is true;
    v_ok := cardinality(v_correct) > 0 and cardinality(v_sel) = cardinality(v_correct) and v_correct <@ v_sel;
    if v_ok then v_score := v_score + v_points; end if;
    insert into public.quiz_answers (submission_id, question_id, selected_option_id, is_correct, points_earned)
    values (v_sub, q.id, v_sel[1], v_ok, case when v_ok then v_points else 0 end);
  end loop;

  update public.quiz_submissions set score = v_score, total_points = v_total where id = v_sub;
  return jsonb_build_object('submission_id', v_sub, 'score', v_score, 'total_points', v_total);
end $$;
revoke all on function public.record_paper_submission(uuid, uuid, jsonb) from public, anon;
grant execute on function public.record_paper_submission(uuid, uuid, jsonb) to authenticated;

-- D. Habilitations
do $$
begin
  if to_regclass('public.permissions') is null then
    raise notice 'table permissions absente : habilitations non ajoutées';
    return;
  end if;

  insert into public.permissions (key, module, label_fr, label_ar, label_en, kind, is_write, sort_order) values
    ('ai.quiz_generator', 'quiz', 'Générer un quiz avec l''IA à partir d''un cours', 'توليد اختبار بالذكاء الاصطناعي من درس', 'Generate a quiz from a course with AI', 'feature', true, 295),
    ('ai.lesson_plan', 'course', 'Fiche pédagogique avec l''IA', 'جذاذة بالذكاء الاصطناعي', 'AI lesson plan', 'feature', true, 165),
    ('ai.omr', 'quiz', 'Corriger des QCM papier par photo', 'تصحيح أوراق الاختيار من متعدد بالصور', 'Grade paper multiple-choice sheets from photos', 'feature', true, 296)
  on conflict (key) do nothing;

  insert into public.plan_permissions (plan_id, permission_key, limit_value)
  select pp.plan_id, x.k, null
  from public.plan_permissions pp
  join (values ('quiz.edit', 'ai.quiz_generator'),
               ('course.edit', 'ai.lesson_plan'),
               ('quiz.results_view', 'ai.omr')) as x(src, k) on x.src = pp.permission_key
  where not exists (select 1 from public.plan_permissions y where y.plan_id = pp.plan_id and y.permission_key = x.k);
end $$;

notify pgrst, 'reload schema';
