-- Add room_id to enrollments table to properly isolate students by room
-- This will ensure students are linked to rooms through enrollments

-- Add room_id column to enrollments table
ALTER TABLE public.enrollments 
ADD COLUMN room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE;

-- Update existing enrollments to set room_id based on course's room_id
UPDATE public.enrollments 
SET room_id = courses.room_id 
FROM public.courses 
WHERE enrollments.course_id = courses.id;

-- Create index for better performance
CREATE INDEX idx_enrollments_room_id ON public.enrollments(room_id);

-- Update RLS policies to consider room isolation
DROP POLICY IF EXISTS "Professors can manage enrollments for their courses" ON public.enrollments;

-- New policy: Professors can manage enrollments in their rooms
CREATE POLICY "Professors can manage enrollments in their rooms" 
ON public.enrollments 
FOR ALL 
USING (auth.uid() IN ( 
  SELECT rooms.professor_id
  FROM public.rooms
  WHERE rooms.id = enrollments.room_id
));

-- Add trigger to automatically set room_id when enrolling students
CREATE OR REPLACE FUNCTION public.set_enrollment_room_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get room_id from the course
  SELECT room_id INTO NEW.room_id 
  FROM public.courses 
  WHERE id = NEW.course_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_enrollment_room_id
  BEFORE INSERT ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_enrollment_room_id();