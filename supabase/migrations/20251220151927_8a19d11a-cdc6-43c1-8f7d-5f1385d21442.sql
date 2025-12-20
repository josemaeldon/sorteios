-- Add avatar_url column to usuarios table
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to avatars
CREATE POLICY "Public can view avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload avatars"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'avatars');

-- Allow users to update their own avatars
CREATE POLICY "Users can update avatars"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'avatars');

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete avatars"
ON storage.objects
FOR DELETE
USING (bucket_id = 'avatars');