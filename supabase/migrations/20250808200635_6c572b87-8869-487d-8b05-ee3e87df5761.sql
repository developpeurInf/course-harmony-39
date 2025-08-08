-- Create course-materials bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-materials', 'course-materials', false)
ON CONFLICT (id) DO NOTHING;

-- Simple policies for course-materials bucket
-- Professors can manage course materials
CREATE POLICY "Professors can manage course materials"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'professor'
  )
)
WITH CHECK (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'professor'
  )
);

-- Students can view course materials (will be restricted later with enrollments)
CREATE POLICY "Students can view course materials"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'student'
  )
);