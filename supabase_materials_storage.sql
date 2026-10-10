-- ==============================================================================
-- SUPABASE STORAGE CONFIGURATION FOR "Materials" BUCKET
-- Run this SQL in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/teszyojnwaedjvqaqake/sql/new
-- ==============================================================================

-- 1. Ensure the "Materials" bucket exists and is configured as public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('Materials', 'Materials', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- 2. Ensure RLS is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow public/anon and authenticated users to upload into "Materials"
DROP POLICY IF EXISTS "Public Upload to Materials Bucket" ON storage.objects;
CREATE POLICY "Public Upload to Materials Bucket"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'Materials');

-- 4. Policy: Allow anyone to view and download files from "Materials"
DROP POLICY IF EXISTS "Public Read from Materials Bucket" ON storage.objects;
CREATE POLICY "Public Read from Materials Bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'Materials');

-- 5. Policy: Allow update/upsert of files in "Materials"
DROP POLICY IF EXISTS "Public Update Materials Bucket" ON storage.objects;
CREATE POLICY "Public Update Materials Bucket"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'Materials')
WITH CHECK (bucket_id = 'Materials');

-- 6. Policy: Allow deleting files from "Materials"
DROP POLICY IF EXISTS "Public Delete Materials Bucket" ON storage.objects;
CREATE POLICY "Public Delete Materials Bucket"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'Materials');
