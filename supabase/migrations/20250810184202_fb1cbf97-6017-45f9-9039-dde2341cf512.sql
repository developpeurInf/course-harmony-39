-- Fix security warning: Set search_path for update_session_duration function
CREATE OR REPLACE FUNCTION public.update_session_duration()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.session_end IS NOT NULL AND OLD.session_end IS NULL THEN
    NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.session_end - NEW.session_start)) / 60;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;