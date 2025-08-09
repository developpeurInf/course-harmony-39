-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (regexp_split_to_array(name, '_'))[1]);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'avatars' AND auth.uid()::text = (regexp_split_to_array(name, '_'))[1]);

CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'avatars' AND auth.uid()::text = (regexp_split_to_array(name, '_'))[1]);

-- Add password_reset_requests table for managing student password reset requests
CREATE TABLE password_reset_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  professor_id UUID NOT NULL,
  room_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on password reset requests
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for password reset requests
CREATE POLICY "Students can create their own password reset requests" 
ON password_reset_requests 
FOR INSERT 
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can view their own password reset requests" 
ON password_reset_requests 
FOR SELECT 
USING (auth.uid() = student_id);

CREATE POLICY "Professors can view password reset requests for their students" 
ON password_reset_requests 
FOR SELECT 
USING (auth.uid() = professor_id OR auth.uid() IN (
  SELECT professor_id FROM rooms WHERE id = room_id
));

CREATE POLICY "Professors can update password reset requests for their students" 
ON password_reset_requests 
FOR UPDATE 
USING (auth.uid() = professor_id OR auth.uid() IN (
  SELECT professor_id FROM rooms WHERE id = room_id
));

-- Add trigger for updated_at
CREATE TRIGGER update_password_reset_requests_updated_at
BEFORE UPDATE ON password_reset_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();