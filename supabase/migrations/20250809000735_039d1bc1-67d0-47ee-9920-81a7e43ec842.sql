-- Add username column to profiles table for student authentication
ALTER TABLE public.profiles 
ADD COLUMN username TEXT UNIQUE;

-- Add temporary_password column for initial student passwords
ALTER TABLE public.profiles 
ADD COLUMN temporary_password TEXT;

-- Create index on username for faster lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Update RLS policy to allow username-based authentication
CREATE POLICY "Profiles can be selected by username" 
ON public.profiles 
FOR SELECT 
USING (true);