-- Fix RLS policies for student_sessions and student_activities to properly allow INSERT

-- Drop and recreate the student_sessions policies with proper WITH CHECK clauses
DROP POLICY IF EXISTS "Students can manage their own sessions" ON public.student_sessions;

CREATE POLICY "Students can manage their own sessions"
ON public.student_sessions
FOR ALL
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- Ensure the system can manage sessions policy exists with proper clauses
DROP POLICY IF EXISTS "System can manage sessions" ON public.student_sessions;

CREATE POLICY "System can manage sessions"
ON public.student_sessions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Fix student_activities to ensure inserts work
DROP POLICY IF EXISTS "System can insert activities" ON public.student_activities;

CREATE POLICY "System can insert activities"
ON public.student_activities
FOR INSERT
TO authenticated
WITH CHECK (true);