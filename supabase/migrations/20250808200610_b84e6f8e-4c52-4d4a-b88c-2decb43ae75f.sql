-- Check if course-materials bucket exists and create if not
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-materials', 'course-materials', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for course-materials bucket if they don't exist
-- Professors can upload, view, update, and delete their own course materials
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Professors can upload course materials'
  ) THEN
    CREATE POLICY "Professors can upload course materials"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'course-materials' AND
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'professor'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Professors can view course materials'
  ) THEN
    CREATE POLICY "Professors can view course materials"
    ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'course-materials' AND
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'professor'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Students can view course materials'
  ) THEN
    CREATE POLICY "Students can view course materials"
    ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'course-materials' AND
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'student'
      ) AND
      -- Students can only access materials from courses they're enrolled in
      EXISTS (
        SELECT 1 FROM public.course_enrollments ce
        JOIN public.courses c ON ce.course_id = c.id
        WHERE ce.student_id = auth.uid()
        AND name LIKE 'courses/' || c.id || '/%'
      )
    );
  END IF;
END $$;