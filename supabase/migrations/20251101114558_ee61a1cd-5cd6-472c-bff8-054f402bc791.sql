-- Create a function to auto-close stale sessions
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
END;
$$;