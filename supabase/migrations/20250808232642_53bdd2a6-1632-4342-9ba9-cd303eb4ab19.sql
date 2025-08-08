-- Fix the function search path security issue by recreating the function properly
DROP TRIGGER IF EXISTS trigger_set_enrollment_room_id ON public.enrollments;
DROP FUNCTION IF EXISTS public.set_enrollment_room_id() CASCADE;

CREATE OR REPLACE FUNCTION public.set_enrollment_room_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Get room_id from the course
  SELECT room_id INTO NEW.room_id 
  FROM public.courses 
  WHERE id = NEW.course_id;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_set_enrollment_room_id
  BEFORE INSERT ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_enrollment_room_id();