-- Fix the course-materials bucket to be public for PDF viewing
UPDATE storage.buckets 
SET public = true 
WHERE id = 'course-materials';

-- Create notifications table for course updates
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    course_id UUID,
    exam_id UUID,
    exercise_id UUID
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Professors can create notifications for their course students
CREATE POLICY "Professors can create notifications for their students" 
ON public.notifications 
FOR INSERT 
WITH CHECK (
    auth.uid() IN (
        SELECT courses.professor_id 
        FROM courses 
        WHERE courses.id = course_id
    ) OR 
    auth.uid() IN (
        SELECT courses.professor_id 
        FROM courses 
        JOIN exams ON courses.id = exams.course_id 
        WHERE exams.id = exam_id
    ) OR 
    auth.uid() IN (
        SELECT courses.professor_id 
        FROM courses 
        JOIN exercises ON courses.id = exercises.course_id 
        WHERE exercises.id = exercise_id
    )
);

-- Create trigger for notifications updated_at
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();