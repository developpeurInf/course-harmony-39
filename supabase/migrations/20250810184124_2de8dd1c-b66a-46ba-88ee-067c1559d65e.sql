-- Create student activities table for tracking
CREATE TABLE IF NOT EXISTS public.student_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  room_id UUID,
  activity_type TEXT NOT NULL, -- 'login', 'logout', 'page_visit', 'quiz_attempt', etc.
  activity_data JSONB, -- Additional data about the activity
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create student sessions table for tracking online time
CREATE TABLE IF NOT EXISTS public.student_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  room_id UUID,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_end TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for student_activities
CREATE POLICY "Professors can view activities for their room students"
ON public.student_activities
FOR SELECT
USING (
  auth.uid() IN (
    SELECT r.professor_id 
    FROM rooms r 
    WHERE r.id = student_activities.room_id
  )
);

CREATE POLICY "Students can view their own activities"
ON public.student_activities
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "System can insert activities"
ON public.student_activities
FOR INSERT
WITH CHECK (true);

-- RLS policies for student_sessions
CREATE POLICY "Professors can view sessions for their room students"
ON public.student_sessions
FOR SELECT
USING (
  auth.uid() IN (
    SELECT r.professor_id 
    FROM rooms r 
    WHERE r.id = student_sessions.room_id
  )
);

CREATE POLICY "Students can manage their own sessions"
ON public.student_sessions
FOR ALL
USING (auth.uid() = student_id);

CREATE POLICY "System can manage sessions"
ON public.student_sessions
FOR ALL
USING (true);

-- Create function to update session duration
CREATE OR REPLACE FUNCTION public.update_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_end IS NOT NULL AND OLD.session_end IS NULL THEN
    NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.session_end - NEW.session_start)) / 60;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for session duration updates
CREATE TRIGGER update_student_sessions_duration
  BEFORE UPDATE ON public.student_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_session_duration();

-- Create trigger for updated_at
CREATE TRIGGER update_student_sessions_updated_at
  BEFORE UPDATE ON public.student_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_student_activities_student_id ON public.student_activities(student_id);
CREATE INDEX IF NOT EXISTS idx_student_activities_room_id ON public.student_activities(room_id);
CREATE INDEX IF NOT EXISTS idx_student_activities_created_at ON public.student_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_student_sessions_student_id ON public.student_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_sessions_room_id ON public.student_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_student_sessions_is_active ON public.student_sessions(is_active);