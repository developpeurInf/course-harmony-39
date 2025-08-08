-- Create storage policies now that profiles table exists
CREATE POLICY "Professors can upload course materials" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'professor'
  )
);

CREATE POLICY "Professors can update course materials" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'professor'
  )
);

CREATE POLICY "Professors can delete course materials" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'professor'
  )
);