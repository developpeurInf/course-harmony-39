-- Create course materials storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('course-materials', 'course-materials', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for course materials
CREATE POLICY "Professors can upload course materials" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'course-materials' AND 
           auth.uid() IN (
             SELECT professor_id 
             FROM courses 
             WHERE id = (regexp_split_to_array(name, '/'))[2]::uuid
           ));

CREATE POLICY "Professors can view all course materials" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'course-materials' AND 
       auth.uid() IN (
         SELECT p.id 
         FROM profiles p 
         WHERE p.role = 'professor'
       ));

CREATE POLICY "Students can view course materials for enrolled courses" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'course-materials' AND 
       auth.uid() IN (
         SELECT e.student_id 
         FROM enrollments e 
         WHERE e.course_id = (regexp_split_to_array(name, '/'))[2]::uuid
       ));

CREATE POLICY "Professors can update their course materials" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'course-materials' AND 
       auth.uid() IN (
         SELECT professor_id 
         FROM courses 
         WHERE id = (regexp_split_to_array(name, '/'))[2]::uuid
       ));

CREATE POLICY "Professors can delete their course materials" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'course-materials' AND 
       auth.uid() IN (
         SELECT professor_id 
         FROM courses 
         WHERE id = (regexp_split_to_array(name, '/'))[2]::uuid
       ));