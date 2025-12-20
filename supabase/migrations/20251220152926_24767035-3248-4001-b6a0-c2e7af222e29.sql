-- Add avatar_url column to usuarios table if it doesn't exist
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;