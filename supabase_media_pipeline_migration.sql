-- ============================================================================
-- DIRECT-TO-SUPABASE + HUGGING FACE WORKER MEDIA PIPELINE MIGRATION
-- ============================================================================
-- Run this script in your Supabase Dashboard -> SQL Editor.
-- Safe, idempotent migration for:
--   1. Dedicated private staging bucket: 'raw-uploads' (50 MB max limit)
--   2. Public optimized destination buckets: 'projects' and 'articles'
--   3. 'public.media_assets' table with exact schema & RLS policies
--   4. Supabase Realtime publication for live job tracking & dashboard updates
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. OWNER HELPER (Preserved / Idempotent)
CREATE OR REPLACE FUNCTION public.is_portfolio_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND COALESCE(auth.jwt() ->> 'email', '') <> ''
    AND COALESCE(auth.jwt() ->> 'email', '') <> 'public_visitor@feslineguest.com'
  );
$$;

-- 2. STORAGE BUCKETS ('raw-uploads' private staging + 'projects' & 'articles' public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('raw-uploads', 'raw-uploads', false, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('projects', 'projects', true, 104857600, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 104857600;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('articles', 'articles', true, 104857600, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 104857600;

-- Storage RLS Policies for 'raw-uploads'
-- Note: Direct browser uploads and TUS resumable uploads require INSERT, SELECT, UPDATE.
-- Visitors submitting articles may upload to 'article/%'; owner may upload to 'project/%' or 'article/%'.
DROP POLICY IF EXISTS "Raw Uploads Select" ON storage.objects;
CREATE POLICY "Raw Uploads Select"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'raw-uploads'
  AND (public.is_portfolio_owner() OR name LIKE 'article/%')
);

DROP POLICY IF EXISTS "Raw Uploads Insert" ON storage.objects;
CREATE POLICY "Raw Uploads Insert"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'raw-uploads'
  AND (public.is_portfolio_owner() OR name LIKE 'article/%')
);

DROP POLICY IF EXISTS "Raw Uploads Update (TUS Resumable)" ON storage.objects;
CREATE POLICY "Raw Uploads Update (TUS Resumable)"
ON storage.objects FOR UPDATE TO public
USING (
  bucket_id = 'raw-uploads'
  AND (public.is_portfolio_owner() OR name LIKE 'article/%')
)
WITH CHECK (
  bucket_id = 'raw-uploads'
  AND (public.is_portfolio_owner() OR name LIKE 'article/%')
);

DROP POLICY IF EXISTS "Raw Uploads Owner Delete" ON storage.objects;
CREATE POLICY "Raw Uploads Owner Delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'raw-uploads'
  AND public.is_portfolio_owner()
);

-- 3. ARCHIVE LEGACY TEXT-ID media_assets IF PRESENT, THEN CREATE NEW UUID media_assets
DO $$
DECLARE
  id_data_type TEXT;
BEGIN
  SELECT data_type INTO id_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'media_assets'
    AND column_name = 'id';

  IF id_data_type IS NOT NULL AND id_data_type <> 'uuid' THEN
    DROP TABLE IF EXISTS public.media_assets_legacy;
    ALTER TABLE public.media_assets RENAME TO media_assets_legacy;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type TEXT NOT NULL CHECK (page_type IN ('project', 'article')),
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'queued', 'processing', 'completed', 'failed')),
  raw_path TEXT NOT NULL DEFAULT '',
  file_name TEXT DEFAULT '',
  av1_1080p_url TEXT,
  av1_720p_url TEXT,
  mp4_fallback_url TEXT,
  optimized_image_url TEXT,
  webp_fallback_url TEXT,
  jpeg_fallback_url TEXT,
  thumbnail_url TEXT,
  original_bytes BIGINT DEFAULT 0,
  optimized_bytes BIGINT DEFAULT 0,
  compression_percent NUMERIC(6, 2) DEFAULT 0,
  width INTEGER,
  height INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure any extra helper columns exist if table was already created partially
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS file_name TEXT DEFAULT '';
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS jpeg_fallback_url TEXT;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- Public Read (allows portfolio pages, real-time job tracker, and dashboard to inspect media metadata & status)
DROP POLICY IF EXISTS "Public Read Media Assets" ON public.media_assets;
CREATE POLICY "Public Read Media Assets"
ON public.media_assets FOR SELECT TO public
USING (true);

-- Insert: Owner can insert any valid row; visitors can insert queued/uploading article media jobs
DROP POLICY IF EXISTS "Public Insert Media Assets" ON public.media_assets;
CREATE POLICY "Insert Media Assets"
ON public.media_assets FOR INSERT TO public
WITH CHECK (
  public.is_portfolio_owner()
  OR (page_type = 'article' AND status IN ('uploading', 'queued'))
);

-- Update: Owner can update/retry any job; visitor article submitters can transition uploading -> queued or retry failed -> queued
-- Note: Background Hugging Face worker uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS safely on the server.
DROP POLICY IF EXISTS "Owner Update Media Assets" ON public.media_assets;
DROP POLICY IF EXISTS "Update Media Assets" ON public.media_assets;
CREATE POLICY "Update Media Assets"
ON public.media_assets FOR UPDATE TO public
USING (
  public.is_portfolio_owner()
  OR (page_type = 'article' AND status IN ('uploading', 'failed'))
)
WITH CHECK (
  public.is_portfolio_owner()
  OR (page_type = 'article' AND status IN ('uploading', 'queued') AND raw_path <> '')
);

DROP POLICY IF EXISTS "Owner Delete Media Assets" ON public.media_assets;
CREATE POLICY "Owner Delete Media Assets"
ON public.media_assets FOR DELETE TO authenticated
USING (public.is_portfolio_owner());

CREATE INDEX IF NOT EXISTS idx_media_assets_page_status_created
  ON public.media_assets(page_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_status_created
  ON public.media_assets(status, created_at ASC);

-- 4. ENABLE REALTIME SUBSCRIPTIONS ON media_assets
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.media_assets;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
