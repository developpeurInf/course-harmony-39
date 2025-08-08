-- Create storage buckets for course materials
INSERT INTO storage.buckets (id, name, public) VALUES ('course-materials', 'course-materials', false);

-- Create RLS policies for course materials storage
CREATE POLICY "Professors can upload course materials" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'course-materials' 
  AND auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'professor'
  )
);

CREATE POLICY "Professors can view their own course materials" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'course-materials' 
  AND auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'professor'
  )
);

CREATE POLICY "Professors can update their own course materials" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'course-materials' 
  AND auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'professor'
  )
);

CREATE POLICY "Professors can delete their own course materials" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'course-materials' 
  AND auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'professor'
  )
);

CREATE POLICY "Students can view course materials from enrolled courses" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'course-materials' 
  AND auth.uid() IN (
    SELECT e.student_id 
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE name LIKE c.id::text || '/%'
  )
);