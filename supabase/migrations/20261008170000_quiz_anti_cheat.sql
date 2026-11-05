-- Anti-triche des quiz : incidents enregistres pendant la passation
-- (copier/coller bloques, sorties de l'onglet, touche Impr. ecran...)
ALTER TABLE public.quiz_submissions
  ADD COLUMN IF NOT EXISTS anti_cheat_events integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anti_cheat_log jsonb;

-- Recharge le cache de schema de l'API
NOTIFY pgrst, 'reload schema';
