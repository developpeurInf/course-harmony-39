-- Enable realtime for student_sessions table
ALTER TABLE public.student_sessions REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_sessions;