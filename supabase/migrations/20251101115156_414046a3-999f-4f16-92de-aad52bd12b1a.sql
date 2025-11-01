-- Update the close_stale_sessions function to also close duplicate sessions
-- Only keep the most recent session per student
CREATE OR REPLACE FUNCTION public.close_stale_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Close sessions that haven't had activity in the last 10 minutes
  UPDATE public.student_sessions
  SET 
    is_active = false,
    session_end = COALESCE(session_end, last_activity),
    duration_minutes = COALESCE(
      duration_minutes,
      EXTRACT(EPOCH FROM (COALESCE(session_end, last_activity) - session_start)) / 60
    )
  WHERE 
    is_active = true 
    AND last_activity < NOW() - INTERVAL '10 minutes';
    
  -- Close duplicate active sessions (keep only the most recent one per student)
  WITH ranked_sessions AS (
    SELECT 
      id,
      student_id,
      ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY last_activity DESC) as rn
    FROM public.student_sessions
    WHERE is_active = true
  )
  UPDATE public.student_sessions
  SET 
    is_active = false,
    session_end = COALESCE(session_end, last_activity),
    duration_minutes = COALESCE(
      duration_minutes,
      EXTRACT(EPOCH FROM (COALESCE(session_end, last_activity) - session_start)) / 60
    )
  WHERE id IN (
    SELECT id FROM ranked_sessions WHERE rn > 1
  );
END;
$$;