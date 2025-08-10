-- Add policy to allow professors to update student profiles in their room
CREATE POLICY "Professors can update students in their room"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT r.professor_id 
    FROM rooms r 
    WHERE r.id = profiles.room_id
  )
);

-- Add policy to allow professors to delete students in their room (for the delete function)
CREATE POLICY "Professors can delete students in their room"
ON public.profiles
FOR DELETE
USING (
  role = 'student' 
  AND auth.uid() IN (
    SELECT r.professor_id 
    FROM rooms r 
    WHERE r.id = profiles.room_id
  )
);