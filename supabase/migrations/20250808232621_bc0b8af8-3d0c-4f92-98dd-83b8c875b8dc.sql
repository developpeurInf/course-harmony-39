-- Fix the function search path security issue
DROP FUNCTION IF EXISTS public.set_enrollment_room_id();

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