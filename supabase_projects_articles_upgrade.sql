-- ============================================================================
-- FESLINE ENGINEERING PORTFOLIO: PROJECTS, BLOG CHARTS & VIDEO UPGRADE SQL
-- ============================================================================
-- Safe, non-destructive, and idempotent. Run in Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- 1. UPGRADE PROJECTS TABLE (Scope, Showcase Form Format, Multi-Uploads, Likes)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_scope TEXT DEFAULT 'Personal',
  ADD COLUMN IF NOT EXISTS form_format TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS showcase_pdfs JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS showcase_images JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- Ensure project_scope stays within valid values cleanly when provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.projects'::regclass
      AND conname = 'projects_scope_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_scope_check
      CHECK (project_scope IN ('Personal', 'Industrial', 'Academic', 'Global', ''));
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 2. PROJECT LIKE / UNLIKE ATOMIC RPC FUNCTIONS (Public + Authenticated)
CREATE OR REPLACE FUNCTION public.increment_project_likes(target_project_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.projects
  SET likes_count = COALESCE(likes_count, 0) + 1
  WHERE id = target_project_id
  RETURNING likes_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_project_likes(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.decrement_project_likes(target_project_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.projects
  SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1)
  WHERE id = target_project_id
  RETURNING likes_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_project_likes(TEXT) TO anon, authenticated;

-- 3. ENSURE ARTICLES TABLE SUPPORTS ENHANCED CHART DATA, LIKES & VIEWS
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS chart_data JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- 4. ENSURE STORAGE BUCKETS SUPPORT VIDEO & PDF SHOWCASE PIPELINES (200 MB LIMIT)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('projects', 'projects', true, 209715200, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 209715200, allowed_mime_types = NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('articles', 'articles', true, 209715200, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 209715200, allowed_mime_types = NULL;
