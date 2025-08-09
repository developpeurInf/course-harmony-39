-- Just ensure the profiles table has the username and temporary_password columns
-- This will add them only if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS temporary_password TEXT;