-- Drop existing policies if they exist and recreate everything cleanly
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Course materials are publicly accessible for now" ON storage.objects;
DROP POLICY IF EXISTS "Professors can upload course materials" ON storage.objects;
DROP POLICY IF EXISTS "Professors can update course materials" ON storage.objects;
DROP POLICY IF EXISTS "Professors can delete course materials" ON storage.objects;

-- Create storage policies for avatars (public bucket)
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Create storage policies for course materials (private bucket)
CREATE POLICY "Course materials are publicly accessible for now" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'course-materials');

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